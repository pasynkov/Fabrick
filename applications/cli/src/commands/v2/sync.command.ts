import { Command, CommandRunner, Option } from 'nest-commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import simpleGit from 'simple-git';
import { ApiService } from '../../api.service';
import { CredentialsService } from '../../credentials.service';
import { ConfigService } from '../../services/config.service';
import { StateService } from '../../services/state.service';
import { ClaudeCodeService } from '../../pipeline/llm/claude-code.service';
import { SummarizeScopeService } from '../../pipeline/summarize-scope.service';
import { PatchLogService } from '../../pipeline/patch-log.service';
import { FrontmatterService } from '../../pipeline/frontmatter.service';
import { IndexService } from '../../pipeline/index.service';
import { detectScopes, Scope } from '../../pipeline/scope/detect';
import { estimateScopeSourceBytes, estimateFullscanTokens, estimatePatchTokens, computeRebuildThresholds } from '../../pipeline/threshold';
import { generateAppScopePrompt, patchAppScopePrompt, parseAppPagesOutput, APP_PAGE_SLUGS } from '../../pipeline/llm/prompts';
import { readScopeSources } from '../../pipeline/read-scope-sources';

interface SyncOptions {
  dryRun?: boolean;
  pr?: string;
  title?: string;
}

type SyncMode = 'patch' | 'regen' | 'delete' | 'skip';

interface ScopePlan {
  scope: Scope;
  mode: SyncMode;
  patchTok: number;
  fullscanTok: number;
  threshold: number;
}

@Command({ name: 'sync', description: 'Sync repository changes to Fabrick dossier' })
export class SyncCommand extends CommandRunner {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly api: ApiService,
    private readonly configService: ConfigService,
    private readonly stateService: StateService,
    private readonly claude: ClaudeCodeService,
    private readonly summarize: SummarizeScopeService,
    private readonly patchLog: PatchLogService,
    private readonly frontmatter: FrontmatterService,
    private readonly index: IndexService,
  ) { super(); }

  @Option({ flags: '--dry-run', description: 'Print plan without executing' })
  parseDryRun(): boolean { return true; }

  @Option({ flags: '--pr <number>', description: 'PR number to associate' })
  parsePr(val: string): string { return val; }

  @Option({ flags: '--title <title>', description: 'Title to associate' })
  parseTitle(val: string): string { return val; }

  async run(_params: string[], options: SyncOptions = {}): Promise<void> {
    const cwd = process.cwd();
    const config = this.configService.load();
    const state = this.stateService.load();
    const creds = this.credentials.requireAuth();
    const apiUrl = config.apiUrl ?? creds.api_url;

    const git = simpleGit(cwd);
    const headSha = (await git.revparse(['HEAD'])).trim();
    const baseSha = state.baselineSha;

    // Detect scopes
    const currentScopes = detectScopes(cwd);
    const prevScopeRoots = new Set((state.scopes ?? []).map((s) => s.root));
    const currentScopeRoots = new Set(currentScopes.map((s) => s.root));

    // Get diff files
    let changedFiles: string[] = [];
    if (baseSha) {
      try {
        const diffOutput = await git.diff([`${baseSha}..HEAD`, '--name-only']);
        changedFiles = diffOutput.split('\n').map((l) => l.trim()).filter(Boolean);
      } catch { changedFiles = []; }
    }

    // Build plan
    const plan: ScopePlan[] = [];

    // Deleted scopes
    for (const prevRoot of prevScopeRoots) {
      if (!currentScopeRoots.has(prevRoot)) {
        const scope = { kind: 'app' as const, name: prevRoot, root: prevRoot };
        plan.push({ scope, mode: 'delete', patchTok: 0, fullscanTok: 0, threshold: 0 });
      }
    }

    // Recompute thresholds and decide mode for current scopes
    const rebuildThreshold = computeRebuildThresholds(currentScopes, cwd);
    for (const scope of currentScopes) {
      const scopePath = join(cwd, scope.root);
      const { bytes } = estimateScopeSourceBytes(scopePath);
      const { totalTok: fullscanTotalTok } = estimateFullscanTokens(bytes);
      const threshold = rebuildThreshold[scope.root];

      const isNew = !prevScopeRoots.has(scope.root) || baseSha === null;
      if (isNew) {
        plan.push({ scope, mode: 'regen', patchTok: 0, fullscanTok: fullscanTotalTok, threshold });
        continue;
      }

      const scopeChangedFiles = changedFiles.filter((f) => f.startsWith(scope.root === '.' ? '' : scope.root));
      if (scopeChangedFiles.length === 0) {
        plan.push({ scope, mode: 'skip', patchTok: 0, fullscanTok: fullscanTotalTok, threshold });
        continue;
      }

      // Estimate diff bytes
      const diffBytes = scopeChangedFiles.length * 2000; // rough heuristic
      const existingPagesBytes = readExistingPagesBytes(cwd, scope);
      const { totalTok: patchTok } = estimatePatchTokens(diffBytes, existingPagesBytes);
      const ratio = fullscanTotalTok > 0 ? patchTok / fullscanTotalTok : 0;
      const mode: SyncMode = ratio > threshold ? 'regen' : 'patch';
      plan.push({ scope, mode, patchTok, fullscanTok: fullscanTotalTok, threshold });
    }

    const activePlan = plan.filter((p) => p.mode !== 'skip');

    // Save updated thresholds
    config.scan.rebuildThreshold = rebuildThreshold;
    this.configService.save(config);

    if (options.dryRun) {
      console.log('\nSync Plan:');
      console.log('scope\t\t\t\tmode\tpatchTok\tfullscanTok\tthreshold');
      for (const p of plan) {
        console.log(`${p.scope.root}\t\t${p.mode}\t${p.patchTok}\t\t${p.fullscanTok}\t\t${p.threshold.toFixed(2)}`);
      }
      return;
    }

    if (activePlan.length === 0) {
      console.log('nothing to sync');
      return;
    }

    // Execute LLM passes
    const scopeResults = await Promise.all(activePlan.map((p) => this.executeScopePlan(p, cwd, config.repoName)));

    // Assemble DTO
    const prNumber = options.pr ? parseInt(options.pr, 10) : undefined;
    const prTitle = options.title;

    const scopeEntries = scopeResults
      .filter((r) => r.events.length > 0 || r.mode === 'delete')
      .map((r) => ({ scope: r.scope.root, mode: r.mode as 'patch' | 'regen' | 'delete', events: r.events }));

    const dto = {
      baseSha: baseSha ?? headSha,
      headSha,
      ...(prTitle && { prTitle }),
      ...(prNumber && { prNumber }),
      scopes: scopeEntries,
    };

    let dossierUpdatedId: string;
    try {
      const res = await this.api.post<{ id: string; dossierUpdatedId?: string }>(apiUrl, `/v2/repos/${config.repoId}/dossier/events`, creds.token, dto);
      dossierUpdatedId = res.dossierUpdatedId ?? res.id;
    } catch (e: any) {
      console.error(`Failed to POST dossier events: ${e.message}`);
      process.exit(1);
    }

    // Append patch log
    let totalCost = 0;
    const logScopes = scopeResults.map((r) => { totalCost += r.costUsd; return { name: r.scope.root, mode: r.mode, slugCounts: r.slugCounts, sample: r.sample, description: r.description }; });
    this.patchLog.append(cwd, { at: new Date().toISOString(), title: prTitle ?? `${(baseSha ?? 'null').slice(0, 7)}..${headSha.slice(0, 7)}`, baselineSha: baseSha, headSha, costUsd: totalCost, scopes: logScopes });

    // Advance state
    state.baselineSha = headSha;
    state.lastSyncedAt = new Date().toISOString();
    state.lastDossierUpdatedId = dossierUpdatedId;
    state.scopes = currentScopes;
    this.stateService.save(state);

    console.log(`✓ Synced. dossierUpdatedId: ${dossierUpdatedId}`);
    if (logScopes[0]?.description) console.log(`Summary: ${logScopes[0].description}`);
  }

  private async executeScopePlan(plan: ScopePlan, cwd: string, repoName: string): Promise<{
    scope: Scope; mode: SyncMode; events: any[]; costUsd: number;
    slugCounts: Record<string, { added: number; removed: number; changed: number }>;
    sample: string[]; description: string;
  }> {
    const { scope, mode } = plan;
    const dossierDir = join(cwd, '.fabrick', 'dossier', scope.root);

    if (mode === 'delete') {
      return { scope, mode, events: [], costUsd: 0, slugCounts: {}, sample: [], description: 'Scope removed.' };
    }

    const existingPages = readExistingPages(cwd, scope);
    let newPages: Record<string, string> = {};
    let costUsd = 0;

    if (mode === 'regen') {
      const sources = await readScopeSources(join(cwd, scope.root));
      const { system, user } = generateAppScopePrompt({ scopeName: scope.name, scopeKind: scope.kind, repoName, sources });
      const res = await this.claude.call({ model: 'claude-sonnet-4-6', systemPrompt: system, userInput: user, cwd });
      costUsd = res.costUsd ?? 0;
      newPages = parseAppPagesOutput(res.content);
    } else if (mode === 'patch') {
      // features: [] — patch mode passes no pre-computed feature list; the LLM receives the existing pages verbatim and is expected to infer changes from context
      const { system, user } = patchAppScopePrompt({ scopeName: scope.name, scopeKind: scope.kind, repoName, existingPages, features: [] });
      const res = await this.claude.call({ model: 'claude-sonnet-4-6', systemPrompt: system, userInput: user, cwd });
      costUsd = res.costUsd ?? 0;
      newPages = parseAppPagesOutput(res.content);
    }

    // Stamp frontmatter and write pages
    mkdirSync(dossierDir, { recursive: true });
    const stampedPages: Record<string, string> = {};
    const sha = 'HEAD';
    for (const slug of APP_PAGE_SLUGS) {
      const body = newPages[slug] ?? existingPages[slug] ?? '';
      if (!body) continue;
      const stamped = this.frontmatter.stamp({ name: `${scope.name} — ${slug.replace('.md', '')}`, description: this.frontmatter.firstSentence(body), type: 'dossier', repo: repoName, scope: scope.root, slug, sha, updatedAt: new Date().toISOString() }, body);
      writeFileSync(join(dossierDir, slug), stamped, 'utf8');
      stampedPages[slug] = stamped;
    }

    // Write index
    const indexBody = this.index.build(stampedPages, scope.name);
    writeFileSync(join(dossierDir, 'index.md'), indexBody, 'utf8');

    // Describe
    const description = await this.summarize.describe({ mode, before: existingPages, after: newPages, slugs: APP_PAGE_SLUGS, cwd });

    // Build events
    const events = APP_PAGE_SLUGS
      .filter((slug) => newPages[slug])
      .map((slug) => ({
        type: slug,
        title: slug.replace('.md', ''),
        bodies: { [slug]: newPages[slug] },
        instructions: mode === 'patch' ? 'patch' : undefined,
        meta: { description, costUsd },
      }));

    return { scope, mode, events, costUsd, slugCounts: {}, sample: [], description };
  }
}

function readExistingPages(cwd: string, scope: Scope): Record<string, string> {
  const dossierDir = join(cwd, '.fabrick', 'dossier', scope.root);
  const pages: Record<string, string> = {};
  for (const slug of APP_PAGE_SLUGS) {
    const p = join(dossierDir, slug);
    if (existsSync(p)) {
      try { pages[slug] = readFileSync(p, 'utf8'); } catch { /* skip */ }
    }
  }
  return pages;
}

function readExistingPagesBytes(cwd: string, scope: Scope): number {
  const pages = readExistingPages(cwd, scope);
  return Object.values(pages).reduce((sum, b) => sum + b.length, 0);
}

