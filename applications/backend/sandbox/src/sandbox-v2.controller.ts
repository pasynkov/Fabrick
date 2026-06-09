import { BadRequestException, Body, Controller, Logger, Param, Post } from '@nestjs/common';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { SearchImplV2, synthesizeCompendiumBundle, COMPENDIUM_TOPIC_SLUGS } from '@app/shared';
import { FsCompendiumRepository } from './fs-compendium.repository';
import { FsDossierRepository } from './fs-dossier.repository';

const DOSSIERS_DIR = join(process.cwd(), 'sandbox-data', 'dossiers');
const COMPENDIUM_DIR = join(process.cwd(), 'sandbox-data', 'compendium');
const PROJECT_ID = 'sandbox';

function extractTitle(content: string, fallback: string): string {
  if (content.startsWith('---')) {
    const end = content.indexOf('\n---', 3);
    if (end !== -1) {
      const yaml = content.slice(3, end);
      const match = yaml.match(/^title:\s*(.+)$/m);
      if (match) return match[1].trim();
    }
  }
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return fallback;
}

/**
 * Sandbox v2 endpoints.
 *
 * POST /sandbox/synthesize-v2
 *   Walks repo .fabrick/wiki/ dirs (or REPOS env), copies dossier files into
 *   sandbox-data/dossiers/<repoSlug>/<scope>/<slug>.md, then runs one Sonnet call
 *   to produce 5 compendium pages in sandbox-data/compendium/.
 *
 * POST /v2/orgs/:org/projects/:project/search
 *   Delegates to SearchImplV2 with projectId='sandbox'. No auth required.
 */
@Controller({ version: '1' })
export class SandboxV2Controller {
  private readonly logger = new Logger(SandboxV2Controller.name);

  constructor(
    private readonly searchImplV2: SearchImplV2,
    private readonly fsCompendiumRepo: FsCompendiumRepository,
    private readonly fsDossierRepo: FsDossierRepository,
  ) {}

  @Post('sandbox/synthesize-v2')
  async synthesizeV2(
    @Body() body?: { repos?: string[] },
  ): Promise<{ pages: number; status: string; repos: string[] }> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new BadRequestException('ANTHROPIC_API_KEY env var is required');

    const repoPaths = this.resolveRepoPaths(body?.repos);
    if (repoPaths.length === 0) {
      throw new BadRequestException(
        'No repo paths found. Provide body.repos, REPOS env, or upload blobs first.',
      );
    }

    // Step 1: Copy dossier files into sandbox-data/dossiers/<repoSlug>/<scope>/<slug>.md
    const repoSlugs: string[] = [];
    const bundleRepos: Array<{ slug: string; name: string; scopes: string[] }> = [];
    const currentDossiers: Record<string, any> = {};

    for (const repoPath of repoPaths) {
      const repoSlug = repoPath.split('/').filter(Boolean).pop() ?? repoPath;
      const wikiDir = join(repoPath, '.fabrick', 'wiki');
      if (!existsSync(wikiDir)) {
        this.logger.warn(`skipping ${repoPath}: no .fabrick/wiki dir`);
        continue;
      }

      const writtenScopes = new Set<string>();
      this.copyDossierFiles(wikiDir, repoSlug, writtenScopes);

      repoSlugs.push(repoSlug);
      bundleRepos.push({ slug: repoSlug, name: repoSlug, scopes: Array.from(writtenScopes) });

      // Build currentDossiers entry
      const dossierSlugs: Record<string, any> = {};
      for (const scopeEntry of readdirSync(join(DOSSIERS_DIR, repoSlug), { withFileTypes: true })) {
        if (!scopeEntry.isDirectory()) continue;
        const scopeDir = join(DOSSIERS_DIR, repoSlug, scopeEntry.name);
        const pages: any[] = [];
        for (const fileEntry of readdirSync(scopeDir, { withFileTypes: true })) {
          if (!fileEntry.isFile() || !fileEntry.name.endsWith('.md')) continue;
          const content = readFileSync(join(scopeDir, fileEntry.name), 'utf-8');
          pages.push({ slug: fileEntry.name.replace(/\.md$/, ''), title: extractTitle(content, fileEntry.name), content });
        }
        dossierSlugs[scopeEntry.name] = { pages };
      }
      currentDossiers[repoSlug] = { scopes: Object.entries(dossierSlugs).map(([scope, data]) => ({ scope, ...(data as any) })) };
    }

    if (repoSlugs.length === 0) {
      throw new BadRequestException('No dossier files found in provided repo paths.');
    }

    // Step 2: Build in-memory bundle and run Sonnet regen-compute call
    const bundle = {
      projectId: PROJECT_ID,
      currentCompendium: null,
      currentDossiers,
      repos: bundleRepos,
    };

    this.logger.log(`synthesize-v2: repos=[${repoSlugs.join(',')}], calling Sonnet`);
    const { regenBodies } = await synthesizeCompendiumBundle({
      bundle,
      patchInstructions: '',
      anthropicApiKey: apiKey,
    });

    // Step 3: Write compendium pages to sandbox-data/compendium/<slug>.md
    mkdirSync(COMPENDIUM_DIR, { recursive: true });
    for (const slug of COMPENDIUM_TOPIC_SLUGS) {
      const content = regenBodies[slug] || `---\ntitle: ${slug}\n---\n\nContent not generated.\n`;
      const frontmatter = `---\ntitle: ${extractTitle(content, slug)}\nslug: ${slug}\n---\n`;
      const body = content.startsWith('---') ? content : `${frontmatter}\n${content}`;
      writeFileSync(join(COMPENDIUM_DIR, `${slug}.md`), body, 'utf-8');
    }

    this.logger.log(`synthesize-v2 done: 5 compendium pages written`);
    return { pages: COMPENDIUM_TOPIC_SLUGS.length, status: 'done', repos: repoSlugs };
  }

  @Post('v2/orgs/:org/projects/:project/search')
  async searchV2(
    @Param('org') _org: string,
    @Param('project') _project: string,
    @Body() body: { question: string; reasoning?: boolean },
  ): Promise<{ answer: string; sources: string[]; reasoning?: string }> {
    if (!body?.question) throw new BadRequestException('question is required');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new BadRequestException('ANTHROPIC_API_KEY env var is required');

    let result: Awaited<ReturnType<SearchImplV2['search']>>;
    try {
      result = await this.searchImplV2.search(PROJECT_ID, body.question, apiKey, {
        reasoning: body.reasoning === true,
      });
    } catch (err: any) {
      if (err.message?.includes('No compendium index found')) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    const response: { answer: string; sources: string[]; reasoning?: string } = {
      answer: result.answer,
      sources: result.sources,
    };
    if (result.reasoning !== undefined) response.reasoning = result.reasoning;
    return response;
  }

  private resolveRepoPaths(bodyRepos?: string[]): string[] {
    if (bodyRepos?.length) return bodyRepos;
    const envRepos = (process.env.REPOS ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (envRepos.length) return envRepos;
    return this.loadRepoDirsFromBlobs();
  }

  private loadRepoDirsFromBlobs(): string[] {
    const blobsDir = join(process.cwd(), 'sandbox-data', 'blobs');
    if (!existsSync(blobsDir)) return [];
    return readdirSync(blobsDir).filter((d) => {
      try {
        return statSync(join(blobsDir, d)).isDirectory();
      } catch {
        return false;
      }
    }).map((d) => join(blobsDir, d));
  }

  /**
   * Copy .fabrick/wiki files into sandbox-data/dossiers/<repoSlug>/<scope>/<slug>.md.
   *
   * Layout detection:
   * - If wiki dir contains subdirectories → each subdir is a scope.
   * - If wiki dir contains only flat .md files (no subdirs) → scope = 'root'.
   * - Mixed layout: files at root get scope 'root'; subdirs get their own scope.
   */
  private copyDossierFiles(wikiDir: string, repoSlug: string, writtenScopes: Set<string>): void {
    const entries = readdirSync(wikiDir, { withFileTypes: true });
    const hasSubDirs = entries.some((e) => e.isDirectory());
    const flatFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'index.md');

    // Copy flat files as scope 'root'
    if (flatFiles.length > 0) {
      for (const file of flatFiles) {
        const slug = file.name.replace(/\.md$/, '');
        const destDir = join(DOSSIERS_DIR, repoSlug, 'root');
        mkdirSync(destDir, { recursive: true });
        const content = readFileSync(join(wikiDir, file.name), 'utf-8');
        writeFileSync(join(destDir, file.name), content, 'utf-8');
        writtenScopes.add('root');
        this.logger.debug(`copied ${repoSlug}/root/${slug}`);
      }
    }

    // Copy scoped subdirectory files
    if (hasSubDirs) {
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const scope = entry.name;
        const scopeDir = join(wikiDir, scope);
        const scopeFiles = readdirSync(scopeDir, { withFileTypes: true }).filter(
          (e) => e.isFile() && e.name.endsWith('.md'),
        );
        for (const file of scopeFiles) {
          const destDir = join(DOSSIERS_DIR, repoSlug, scope);
          mkdirSync(destDir, { recursive: true });
          const content = readFileSync(join(scopeDir, file.name), 'utf-8');
          writeFileSync(join(destDir, file.name), content, 'utf-8');
          writtenScopes.add(scope);
          this.logger.debug(`copied ${repoSlug}/${scope}/${file.name.replace(/\.md$/, '')}`);
        }
      }
    }
  }
}
