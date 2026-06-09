import { Command, CommandRunner, Option } from 'nest-commander';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';
import { ApiService } from '../../api.service';
import { CredentialsService } from '../../credentials.service';
import { ConfigService } from '../../services/config.service';
import { StateService } from '../../services/state.service';
import { ClaudeCodeService } from '../../pipeline/llm/claude-code.service';
import { SummarizeScopeService } from '../../pipeline/summarize-scope.service';
import { PatchLogService } from '../../pipeline/patch-log.service';
import { FrontmatterService } from '../../pipeline/frontmatter.service';
import { IndexService } from '../../pipeline/index.service';
import { detectScopes } from '../../pipeline/scope/detect';
import { estimateScopeSourceBytes, estimateFullscanTokens, dynamicThreshold } from '../../pipeline/threshold';
import { generateAppScopePrompt, parseAppPagesOutput, APP_PAGE_SLUGS } from '../../pipeline/llm/prompts';
import simpleGit from 'simple-git';

interface RegenOptions {
  yes?: boolean;
}

@Command({ name: 'regen', description: 'Full regeneration of all scope dossiers' })
export class RegenCommand extends CommandRunner {
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

  @Option({ flags: '--yes', description: 'Skip confirmation prompt' })
  parseYes(): boolean { return true; }

  async run(_params: string[], options: RegenOptions = {}): Promise<void> {
    const cwd = process.cwd();

    if (!options.yes) {
      const confirmed = await this.confirm('wipe all local + remote dossier? (y/N) ');
      if (!confirmed) { console.log('aborted'); return; }
    }

    const config = this.configService.load();
    const creds = this.credentials.requireAuth();
    const apiUrl = config.apiUrl ?? creds.api_url;

    // Wipe local dossier
    const dossierDir = join(cwd, '.fabrick', 'dossier');
    if (existsSync(dossierDir)) {
      rmSync(dossierDir, { recursive: true, force: true });
    }

    // Reset state
    const state = this.stateService.load();
    state.baselineSha = null;
    state.lastDossierUpdatedId = undefined as any;
    this.stateService.save(state);

    const scopes = detectScopes(cwd);
    const git = simpleGit(cwd);
    const headSha = (await git.revparse(['HEAD'])).trim();

    // Run genesis for all scopes in parallel
    const results = await Promise.all(scopes.map((scope) => this.genesisScope(scope, cwd, config.repoName)));

    // Recompute thresholds
    const rebuildThreshold: Record<string, number> = {};
    for (const scope of scopes) {
      const scopePath = join(cwd, scope.root);
      const { bytes } = estimateScopeSourceBytes(scopePath);
      const { totalTok } = estimateFullscanTokens(bytes);
      rebuildThreshold[scope.root] = dynamicThreshold(totalTok);
    }
    config.scan.rebuildThreshold = rebuildThreshold;
    this.configService.save(config);

    // POST events
    const scopeEntries = results.map((r) => ({ scope: r.scope.root, mode: 'regen' as const, events: r.events }));
    const dto = { baseSha: headSha, headSha, scopes: scopeEntries };

    let dossierUpdatedId: string;
    try {
      const res = await this.api.post<{ id: string; dossierUpdatedId?: string }>(apiUrl, `/v2/repos/${config.repoId}/dossier/events`, creds.token, dto);
      dossierUpdatedId = res.dossierUpdatedId ?? res.id;
    } catch (e: any) {
      console.error(`Failed to POST regen events: ${e.message}`);
      process.exit(1);
    }

    // Update state
    state.baselineSha = headSha;
    state.lastSyncedAt = new Date().toISOString();
    state.lastDossierUpdatedId = dossierUpdatedId;
    state.scopes = scopes;
    this.stateService.save(state);

    console.log(`✓ Regen complete. dossierUpdatedId: ${dossierUpdatedId}`);
  }

  private async genesisScope(scope: any, cwd: string, repoName: string): Promise<{ scope: any; events: any[] }> {
    const dossierDir = join(cwd, '.fabrick', 'dossier', scope.root);
    mkdirSync(dossierDir, { recursive: true });

    const sources = await readScopeSources(join(cwd, scope.root));
    const { system, user } = generateAppScopePrompt({ scopeName: scope.name, scopeKind: scope.kind, repoName, sources });
    const res = await this.claude.call({ model: 'claude-sonnet-4-6', systemPrompt: system, userInput: user, cwd });
    const newPages = parseAppPagesOutput(res.content);

    const stampedPages: Record<string, string> = {};
    for (const slug of APP_PAGE_SLUGS) {
      const body = newPages[slug] ?? '';
      if (!body) continue;
      const stamped = this.frontmatter.stamp({ name: `${scope.name} — ${slug.replace('.md', '')}`, description: this.frontmatter.firstSentence(body), type: 'dossier', repo: repoName, scope: scope.root, slug, sha: 'HEAD', updatedAt: new Date().toISOString() }, body);
      writeFileSync(join(dossierDir, slug), stamped, 'utf8');
      stampedPages[slug] = stamped;
    }

    const indexBody = this.index.build(stampedPages, scope.name);
    writeFileSync(join(dossierDir, 'index.md'), indexBody, 'utf8');

    const events = APP_PAGE_SLUGS
      .filter((slug) => newPages[slug])
      .map((slug) => ({ type: slug, title: slug.replace('.md', ''), bodies: { [slug]: newPages[slug] }, meta: { costUsd: res.costUsd } }));

    return { scope, events };
  }

  private confirm(prompt: string): Promise<boolean> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => { rl.close(); resolve(answer.toLowerCase() === 'y'); });
    });
  }
}

async function readScopeSources(scopeRoot: string): Promise<Array<{ file: string; content: string }>> {
  const { readdirSync, readFileSync, existsSync } = await import('fs');
  const { join: pathJoin } = await import('path');
  const SOURCE_EXT = /\.(tsx?|jsx?)$/i;
  const SKIP_DIR = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.fabrick']);
  const MAX_FILES = 30;
  const MAX_BYTES = 8000;
  const out: Array<{ file: string; content: string }> = [];
  function walk(dir: string, rel: string): void {
    if (out.length >= MAX_FILES) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (out.length >= MAX_FILES) return;
      if (SKIP_DIR.has(e.name)) continue;
      const full = pathJoin(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { walk(full, r); continue; }
      if (!e.isFile() || !SOURCE_EXT.test(e.name)) continue;
      try { out.push({ file: r, content: readFileSync(full, 'utf8').slice(0, MAX_BYTES) }); } catch { /* skip */ }
    }
  }
  if (existsSync(scopeRoot)) walk(scopeRoot, '');
  return out;
}
