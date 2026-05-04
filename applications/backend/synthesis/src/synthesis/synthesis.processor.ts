import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import { QUEUE_SERVICE } from '../queue/queue.module';
import { QueueService } from '../queue/queue.interface';
import { StorageService } from '../storage/storage.service';

interface SynthesisJob {
  projectId: string;
  orgSlug: string;
  projectSlug: string;
  repos: { id: string; slug: string }[];
  callbackToken: string;
  anthropicApiKey?: string;
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
    const { projectId, orgSlug, projectSlug, repos, callbackToken, anthropicApiKey } = job;
    try {
      this.logger.log(`[${projectSlug}] loading repos`);
      this.logger.log(`[${projectSlug}] found ${repos.length} repos`);

      const anthropic = new Anthropic({ apiKey: anthropicApiKey });

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
      this.logger.log(`[${projectSlug}] calling Anthropic, input ~${userMessage.length} chars`);

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
      this.logger.log(`[${projectSlug}] synthesis done`);
    } catch (err: any) {
      this.logger.error(`[${projectSlug}] synthesis failed: ${err?.message}`);
      await this.reportStatus(projectId, callbackToken, 'error', err?.message ?? 'Unknown error');
    }
  }

  private async reportStatus(projectId: string, callbackToken: string, status: string, error?: string): Promise<void> {
    try {
      const body: Record<string, string> = { projectId, status };
      if (error) body.error = error;
      const res = await fetch(`${this.apiBaseUrl}/internal/synthesis/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${callbackToken}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        this.logger.error(`[${projectId}] callback failed: HTTP ${res.status}`);
      }
    } catch (err: any) {
      this.logger.error(`[${projectId}] callback error: ${err?.message}`);
    }
  }
}
