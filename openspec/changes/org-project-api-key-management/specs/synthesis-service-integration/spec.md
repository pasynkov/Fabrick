# Synthesis Service Integration for API Key Management

## Overview
Integration of hierarchical API key resolution into the synthesis service and processor to use project-specific or organization-specific Anthropic API keys instead of the global environment variable.

## SynthesisService Updates

### Updated Synthesis Trigger
```typescript
// applications/backend/api/src/synthesis/synthesis.service.ts
import { ApiKeyResolutionService } from '../api-keys/api-key-resolution.service';
import { ApiKeyAuditService } from '../api-keys/api-key-audit.service';

@Injectable()
export class SynthesisService {
  // ... existing constructor and imports

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: TypeOrmRepository<Project>,
    @InjectRepository(Organization)
    private readonly orgRepo: TypeOrmRepository<Organization>,
    @InjectRepository(OrgMember)
    private readonly memberRepo: TypeOrmRepository<OrgMember>,
    @InjectRepository(Repository)
    private readonly repoRepo: TypeOrmRepository<Repository>,
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    private readonly storageService: StorageService,
    private readonly jwtService: JwtService,
    // Add new dependencies
    private readonly apiKeyResolutionService: ApiKeyResolutionService,
    private readonly apiKeyAuditService: ApiKeyAuditService,
  ) {}

  async triggerForProject(projectId: string, userId: string): Promise<void> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    await this.requireOrgMember(userId, project.orgId);

    if (project.synthStatus === 'running') {
      throw new ConflictException('Synthesis already running');
    }

    // Resolve API key for this project
    let apiKeyResolution;
    try {
      apiKeyResolution = await this.apiKeyResolutionService.resolveForProject(projectId);
      
      // Validate that we have a usable API key
      if (!this.apiKeyResolutionService.validateResolution(apiKeyResolution)) {
        throw new Error('Invalid API key resolution result');
      }

      // Audit the API key usage
      await this.apiKeyAuditService.logApiKeyUsage(apiKeyResolution);
    } catch (error) {
      this.logger.error(`[${project.slug}] API key resolution failed: ${error.message}`);
      throw new ConflictException(
        `No valid API key available for synthesis. Please configure an API key for this project or organization.`
      );
    }

    const org = await this.orgRepo.findOne({ where: { id: project.orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const repos = await this.repoRepo.find({ where: { projectId } });

    const callbackToken = this.jwtService.sign(
      { sub: projectId, scope: 'synth-callback' },
      { expiresIn: '1h' },
    );

    await this.projectRepo.update(projectId, { synthStatus: 'running', synthError: null });
    this.logger.log(`[${project.slug}] synthesis triggered by user ${userId} using ${apiKeyResolution.source} API key`);

    // Pass API key resolution info to the synthesis job
    await this.queueService.publish('synthesis-jobs', {
      projectId,
      orgSlug: org.slug,
      projectSlug: project.slug,
      repos: repos.map((r) => ({ id: r.id, slug: r.slug })),
      callbackToken,
      apiKey: apiKeyResolution.apiKey, // Pass resolved API key
      apiKeySource: apiKeyResolution.source, // For logging/debugging
    });
  }

  // ... rest of existing methods unchanged
}
```

## SynthesisProcessor Updates

### Updated Job Interface and Processor
```typescript
// applications/backend/synthesis/src/synthesis/synthesis.processor.ts
import Anthropic from '@anthropic-ai/sdk';

interface SynthesisJob {
  projectId: string;
  orgSlug: string;
  projectSlug: string;
  repos: { id: string; slug: string }[];
  callbackToken: string;
  apiKey: string; // New: resolved API key for this job
  apiKeySource: 'project' | 'organization' | 'global'; // New: source for logging
}

@Injectable()
export class SynthesisProcessor implements OnModuleInit {
  private readonly logger = new Logger(SynthesisProcessor.name);
  private readonly systemPrompt: string;
  private readonly apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

  constructor(
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    private readonly storageService: StorageService,
  ) {
    this.systemPrompt = readFileSync(
      join(__dirname, '..', 'assets', 'synthesis-prompt.txt'),
      'utf-8',
    );
  }

  async onModuleInit() {
    await this.queueService.subscribe('synthesis-jobs', async (payload) => {
      await this.processJob(payload as unknown as SynthesisJob);
    });
    this.logger.log('Subscribed to synthesis-jobs queue');
  }

  private async processJob(job: SynthesisJob): Promise<void> {
    const { projectId, orgSlug, projectSlug, repos, callbackToken, apiKey, apiKeySource } = job;
    
    // Create Anthropic client with the resolved API key
    const anthropic = new Anthropic({ apiKey });
    
    try {
      this.logger.log(`[${projectSlug}] starting synthesis with ${apiKeySource} API key`);
      this.logger.log(`[${projectSlug}] loading repos`);
      this.logger.log(`[${projectSlug}] found ${repos.length} repos`);

      const contextBlocks: string[] = [];
      for (const repo of repos) {
        const prefix = `${projectSlug}/${repo.slug}/context/`;
        this.logger.log(`[${projectSlug}] listing context at ${orgSlug}/${prefix}`);
        const keys = await this.storageService.listObjects(orgSlug, prefix);
        this.logger.log(`[${projectSlug}/${repo.slug}] ${keys.length} context files`);
        if (keys.length === 0) continue;

        let block = `=== REPO: ${repo.slug} ===\n`;
        for (const key of keys) {
          const fileName = key.slice(prefix.length);
          const content = await this.storageService.getObject(orgSlug, key);
          block += `--- ${fileName} ---\n${content.toString('utf-8')}\n`;
        }
        contextBlocks.push(block);
      }

      if (contextBlocks.length === 0) {
        this.logger.warn(`[${projectSlug}] no context files found`);
        await this.reportStatus(projectId, callbackToken, 'error', 'No context files found for any repository');
        return;
      }

      const userMessage = contextBlocks.join('\n\n');
      this.logger.log(`[${projectSlug}] calling Anthropic with ${apiKeySource} key, input ~${userMessage.length} chars`);

      // Use the project-specific Anthropic client
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 16000,
        system: this.systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const rawText = response.content.find((c) => c.type === 'text')?.text ?? '';
      this.logger.log(`[${projectSlug}] Anthropic response ${rawText.length} chars, stop_reason=${response.stop_reason}`);
      
      if (response.stop_reason === 'max_tokens') {
        throw new Error('Anthropic response truncated (max_tokens reached) — increase max_tokens or reduce context');
      }

      const text = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

      let parsed: { files: Record<string, string> };
      try {
        parsed = JSON.parse(text);
      } catch (parseErr: any) {
        this.logger.error(`[${projectSlug}] JSON parse failed: ${parseErr.message}`);
        this.logger.debug(`[${projectSlug}] raw response (first 500): ${rawText.slice(0, 500)}`);
        throw new Error(`Claude returned non-JSON: ${parseErr.message}`);
      }

      const fileCount = Object.keys(parsed.files).length;
      this.logger.log(`[${projectSlug}] parsed ${fileCount} synthesis files`);

      const synthPrefix = `${projectSlug}/synthesis/`;
      for (const [path, content] of Object.entries(parsed.files)) {
        await this.storageService.putObject(
          orgSlug,
          `${synthPrefix}${path}`,
          Buffer.from(content, 'utf-8'),
        );
        this.logger.log(`[${projectSlug}] stored ${path}`);
      }

      await this.reportStatus(projectId, callbackToken, 'done');
      this.logger.log(`[${projectSlug}] synthesis done using ${apiKeySource} API key`);
    } catch (err: any) {
      this.logger.error(`[${projectSlug}] synthesis failed with ${apiKeySource} key: ${err?.message}`);
      
      // Enhanced error reporting that includes API key source context
      let errorMessage = err?.message ?? 'Unknown error';
      if (err?.status === 401) {
        errorMessage = `API key authentication failed (${apiKeySource} key). Please check your API key configuration.`;
      } else if (err?.status === 429) {
        errorMessage = `Rate limit exceeded on ${apiKeySource} API key. Please try again later.`;
      } else if (err?.status === 403) {
        errorMessage = `API key permission denied (${apiKeySource} key). Please check your API key permissions.`;
      }
      
      await this.reportStatus(projectId, callbackToken, 'error', errorMessage);
    }
  }

  // ... rest of existing methods unchanged
}
```

## Backward Compatibility

### Fallback Handling
```typescript
// Enhanced fallback logic in case job doesn't include API key info
private async processJob(job: SynthesisJob): Promise<void> {
  // Handle both new and old job formats for backward compatibility
  let apiKey: string;
  let apiKeySource: string;

  if (job.apiKey) {
    // New format with resolved API key
    apiKey = job.apiKey;
    apiKeySource = job.apiKeySource || 'unknown';
  } else {
    // Legacy format - fall back to global environment variable
    apiKey = process.env.ANTHROPIC_API_KEY!;
    apiKeySource = 'global-legacy';
    
    if (!apiKey) {
      throw new Error('No API key available for synthesis');
    }
  }

  const anthropic = new Anthropic({ apiKey });
  // ... rest of processing logic
}
```

## Error Handling Enhancements

### API Key Resolution Errors
```typescript
// In SynthesisService.triggerForProject
try {
  apiKeyResolution = await this.apiKeyResolutionService.resolveForProject(projectId);
} catch (error) {
  let userFriendlyMessage: string;
  
  if (error.message.includes('not found')) {
    userFriendlyMessage = 'Project or organization not found';
  } else if (error.message.includes('No API key available')) {
    userFriendlyMessage = 'No Anthropic API key is configured for this project, organization, or globally. Please configure an API key to enable synthesis.';
  } else if (error.message.includes('decrypt')) {
    userFriendlyMessage = 'API key configuration error. Please contact support or reconfigure your API key.';
  } else {
    userFriendlyMessage = 'Unable to resolve API key for synthesis. Please try again or contact support.';
  }
  
  this.logger.error(`[${project.slug}] API key resolution failed: ${error.message}`);
  throw new ConflictException(userFriendlyMessage);
}
```

### Enhanced API Error Handling
```typescript
// In SynthesisProcessor
catch (err: any) {
  this.logger.error(`[${projectSlug}] synthesis failed with ${apiKeySource} key: ${err?.message}`);
  
  let errorMessage = err?.message ?? 'Unknown error';
  let suggestedAction = '';
  
  if (err?.status === 401) {
    errorMessage = 'API key authentication failed';
    suggestedAction = apiKeySource === 'global' 
      ? 'Please check the global ANTHROPIC_API_KEY configuration.'
      : `Please verify your ${apiKeySource} API key in the settings.`;
  } else if (err?.status === 429) {
    errorMessage = 'Rate limit exceeded';
    suggestedAction = 'Please try again later or consider upgrading your API key tier.';
  } else if (err?.status === 403) {
    errorMessage = 'API key permissions insufficient';
    suggestedAction = 'Please check your API key has the required permissions.';
  } else if (err?.code === 'insufficient_quota') {
    errorMessage = 'API quota exceeded';
    suggestedAction = 'Please check your Anthropic account billing and usage.';
  }
  
  const fullErrorMessage = suggestedAction 
    ? `${errorMessage}. ${suggestedAction}`
    : errorMessage;
    
  await this.reportStatus(projectId, callbackToken, 'error', fullErrorMessage);
}
```

## Module Integration

### Updated Dependencies
```typescript
// applications/backend/api/src/synthesis/synthesis.module.ts
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Organization, OrgMember, Repository]),
    QueueModule,
    StorageModule,
    JwtModule,
    ApiKeysModule, // Add API Keys module
  ],
  controllers: [SynthesisController],
  providers: [SynthesisService],
})
export class SynthesisModule {}
```

## Performance Considerations

### API Key Caching
```typescript
// Optional: Add caching to avoid repeated decryption
@Injectable()
export class CachedApiKeyResolutionService {
  private cache = new Map<string, { apiKey: string; expiry: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly apiKeyResolutionService: ApiKeyResolutionService,
  ) {}

  async resolveForProject(projectId: string): Promise<ApiKeyResolution> {
    const cacheKey = `project:${projectId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expiry > Date.now()) {
      return {
        apiKey: cached.apiKey,
        source: 'cached', // Track cache usage
        projectId,
      };
    }

    const resolution = await this.apiKeyResolutionService.resolveForProject(projectId);
    
    // Cache the resolved API key (encrypted keys are cached, not plaintext)
    this.cache.set(cacheKey, {
      apiKey: resolution.apiKey,
      expiry: Date.now() + this.CACHE_TTL,
    });

    return resolution;
  }
}
```

## Testing Considerations

### Mock API Key Resolution
```typescript
// For testing synthesis service
const mockApiKeyResolution = {
  apiKey: 'sk-ant-test-key',
  source: 'project' as const,
  projectId: 'test-project',
  orgId: 'test-org',
};

jest.spyOn(apiKeyResolutionService, 'resolveForProject')
  .mockResolvedValue(mockApiKeyResolution);
```

## Migration Strategy

### Gradual Rollout
1. **Phase 1**: Deploy API key resolution with fallback to global key
2. **Phase 2**: Update synthesis service to use resolution service
3. **Phase 3**: Update UI to allow API key configuration
4. **Phase 4**: Encourage organizations to set their own keys
5. **Phase 5**: Monitor usage and optimize performance

### Feature Flags
Consider adding feature flags to control:
- API key resolution vs. global key usage
- Specific organization or project API key usage
- Audit logging granularity