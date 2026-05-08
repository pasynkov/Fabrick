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
  changedRepos: string[];
  callbackToken: string;
  anthropicApiKey: string;
}

interface WikiPageData {
  slug: string;
  category: string;
  title: string;
  content: string;
  sources: string[];
  related: string[];
}

interface ExistingPage {
  slug: string;
  category: string;
  title: string;
  content: string;
  sources: string[];
  related: string[];
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
    const { projectId, orgSlug, projectSlug, repos, changedRepos, callbackToken, anthropicApiKey } = job;
    try {
      this.logger.log(`[${projectSlug}] loading repo wikis, changedRepos=${changedRepos.join(',')}`);

      if (!anthropicApiKey) throw new Error('No API key provided for synthesis job');
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });

      // Load existing project wiki pages for incremental mode
      const existingPages = await this.loadExistingPages(projectId, callbackToken);
      const hasExisting = existingPages.length > 0;
      const isIncremental = hasExisting && changedRepos.length > 0 && changedRepos.length < repos.length;

      // Build context blocks from repo wikis
      const contextBlocks: string[] = [];
      for (const repo of repos) {
        const prefix = `${projectSlug}/${repo.slug}/wiki/`;
        const keys = await this.storageService.listObjects(orgSlug, prefix);
        if (keys.length === 0) continue;

        const isChanged = changedRepos.includes(repo.slug);

        if (isIncremental && !isChanged) {
          // Unchanged repo in incremental mode: load only index.md
          const indexKey = keys.find((k) => k.endsWith('/index.md') || k === `${prefix}index.md`);
          if (indexKey) {
            const content = await this.storageService.getObject(orgSlug, indexKey);
            contextBlocks.push(`=== REPO-INDEX: ${repo.slug} ===\n${content.toString('utf-8')}`);
          }
        } else {
          // Changed repo or full mode: load all pages
          let block = `=== REPO: ${repo.slug} ===\n`;
          for (const key of keys) {
            const content = await this.storageService.getObject(orgSlug, key);
            block += content.toString('utf-8') + '\n\n';
          }
          contextBlocks.push(block);
        }
      }

      if (contextBlocks.length === 0) {
        this.logger.warn(`[${projectSlug}] no wiki files found`);
        await this.reportStatus(projectId, callbackToken, 'error', 'No wiki files found for any repository');
        return;
      }

      // Add existing pages for incremental mode
      if (isIncremental) {
        for (const page of existingPages) {
          contextBlocks.push(
            `=== EXISTING: ${page.slug} ===\n---\nslug: ${page.slug}\ncategory: ${page.category}\ntitle: ${page.title}\nsources: [${page.sources.join(', ')}]\nrelated: [${page.related.join(', ')}]\n---\n${page.content}`,
          );
        }
      }

      const userMessage = contextBlocks.join('\n\n');
      this.logger.log(`[${projectSlug}] calling Anthropic (${isIncremental ? 'incremental' : 'full'}), input ~${userMessage.length} chars`);

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 32000,
        system: this.systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const rawText = response.content.find((c) => c.type === 'text')?.text ?? '';
      this.logger.log(`[${projectSlug}] response ${rawText.length} chars, stop_reason=${response.stop_reason}`);
      if (response.stop_reason === 'max_tokens') {
        throw new Error('Anthropic response truncated (max_tokens reached)');
      }

      // Parse pages and deletes
      const { pages, deleteSlugs } = this.parseResponse(rawText);

      if (pages.length === 0) {
        throw new Error('No pages found in Claude response');
      }

      this.logger.log(`[${projectSlug}] parsed ${pages.length} pages, ${deleteSlugs.length} deletes`);

      // Upsert pages
      await this.upsertPages(projectId, callbackToken, pages);

      // Delete marked pages
      if (deleteSlugs.length > 0) {
        await this.deletePages(projectId, callbackToken, deleteSlugs);
      }

      await this.reportStatus(projectId, callbackToken, 'done');
      this.logger.log(`[${projectSlug}] synthesis done`);
    } catch (err: any) {
      this.logger.error(`[${projectSlug}] synthesis failed: ${err?.message}`);
      await this.reportStatus(projectId, callbackToken, 'error', err?.message ?? 'Unknown error');
    }
  }

  private parseResponse(rawText: string): { pages: WikiPageData[]; deleteSlugs: string[] } {
    const pages: WikiPageData[] = [];
    const deleteSlugs: string[] = [];

    // Split by PAGE or DELETE markers
    const parts = rawText.split(/\n?=== (?:PAGE|DELETE): /);

    for (const part of parts.slice(1)) {
      const markerEnd = part.indexOf(' ===');
      if (markerEnd === -1) {
        // No closing ===, try just newline
        const nlEnd = part.indexOf('\n');
        if (nlEnd === -1) continue;
        // This is a DELETE without ===
        const slug = part.slice(0, nlEnd).trim();
        deleteSlugs.push(slug);
        continue;
      }

      const slug = part.slice(0, markerEnd).trim();
      const rest = part.slice(markerEnd + 4).replace(/^\r?\n/, '');

      // Check if this is a DELETE marker (no content after)
      if (rest.trim() === '' && !rawText.includes(`=== PAGE: ${slug}`)) {
        deleteSlugs.push(slug);
        continue;
      }

      // Parse frontmatter
      const frontmatterMatch = rest.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
      if (!frontmatterMatch) continue;

      const yamlStr = frontmatterMatch[1];
      const content = frontmatterMatch[2].trim();

      const page = this.parseFrontmatter(slug, yamlStr, content);
      if (page) pages.push(page);
    }

    // Also extract DELETE markers that appear standalone
    const deleteMatches = rawText.matchAll(/=== DELETE: ([^\s=]+) ===/g);
    for (const match of deleteMatches) {
      const slug = match[1].trim();
      if (!deleteSlugs.includes(slug)) deleteSlugs.push(slug);
    }

    return { pages, deleteSlugs };
  }

  private parseFrontmatter(slug: string, yaml: string, content: string): WikiPageData | null {
    const slugMatch = yaml.match(/^slug:\s*(.+)$/m);
    const categoryMatch = yaml.match(/^category:\s*(.+)$/m);
    const titleMatch = yaml.match(/^title:\s*(.+)$/m);

    const parsedSlug = slugMatch?.[1]?.trim() ?? slug;
    const category = categoryMatch?.[1]?.trim() ?? 'overview';
    const title = titleMatch?.[1]?.trim() ?? parsedSlug;

    // Parse sources array
    const sourcesBlockMatch = yaml.match(/^sources:\s*\n((?:\s*-\s*.+\n?)*)/m);
    const sourcesInlineMatch = yaml.match(/^sources:\s*\[([^\]]*)\]/m);
    let sources: string[] = [];
    if (sourcesBlockMatch) {
      sources = sourcesBlockMatch[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
    } else if (sourcesInlineMatch) {
      sources = sourcesInlineMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    }

    // Parse related array
    const relatedBlockMatch = yaml.match(/^related:\s*\n((?:\s*-\s*.+\n?)*)/m);
    const relatedInlineMatch = yaml.match(/^related:\s*\[([^\]]*)\]/m);
    let related: string[] = [];
    if (relatedBlockMatch) {
      related = relatedBlockMatch[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
    } else if (relatedInlineMatch) {
      related = relatedInlineMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    }

    return { slug: parsedSlug, category, title, content, sources, related };
  }

  private async loadExistingPages(projectId: string, callbackToken: string): Promise<ExistingPage[]> {
    try {
      const url = `${this.apiBaseUrl}/v1/internal/synthesis/pages?projectId=${projectId}&callbackToken=${encodeURIComponent(callbackToken)}`;
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) return [];
      const data = await res.json() as { pages: ExistingPage[] };
      return data.pages ?? [];
    } catch {
      return [];
    }
  }

  private async upsertPages(projectId: string, callbackToken: string, pages: WikiPageData[]): Promise<void> {
    const res = await fetch(`${this.apiBaseUrl}/v1/internal/synthesis/pages`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, callbackToken, pages }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to upsert pages: ${res.status} ${body}`);
    }
  }

  private async deletePages(projectId: string, callbackToken: string, slugs: string[]): Promise<void> {
    const res = await fetch(`${this.apiBaseUrl}/v1/internal/synthesis/pages`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, callbackToken, slugs }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.warn(`Failed to delete pages: ${res.status} ${body}`);
    }
  }

  private async reportStatus(projectId: string, callbackToken: string, status: string, error?: string): Promise<void> {
    try {
      const body: Record<string, string> = { projectId, status };
      if (error) body.error = error;
      const res = await fetch(`${this.apiBaseUrl}/v1/internal/synthesis/status`, {
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
