import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QUEUE_SERVICE } from '../queue/queue.module';
import { QueueService } from '../queue/queue.interface';
import { StorageService } from '../storage/storage.service';
import { SynthesisImpl, RepoWikiInput, ExistingPage } from '@app/shared';

interface SynthesisJob {
  projectId: string;
  orgSlug: string;
  projectSlug: string;
  repos: { id: string; slug: string }[];
  changedRepos: string[];
  callbackToken: string;
  anthropicApiKey: string;
}

@Injectable()
export class SynthesisProcessor implements OnModuleInit {
  private readonly logger = new Logger(SynthesisProcessor.name);
  private readonly apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

  constructor(
    @Inject(QUEUE_SERVICE) private readonly queueService: QueueService,
    private readonly storageService: StorageService,
    private readonly synthesisImpl: SynthesisImpl,
  ) {}

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

      // Load existing project wiki pages for incremental mode
      const existingPages = await this.loadExistingPages(projectId, callbackToken);

      // Load wiki files from blob storage
      const repoWikis: RepoWikiInput[] = [];
      for (const repo of repos) {
        const prefix = `${projectSlug}/${repo.slug}/wiki/`;
        const keys = await this.storageService.listObjects(orgSlug, prefix);
        if (keys.length === 0) continue;

        const indexKey = keys.find((k) => k.endsWith('/index.md') || k === `${prefix}index.md`);
        let indexContent: string | undefined;
        if (indexKey) {
          const buf = await this.storageService.getObject(orgSlug, indexKey);
          indexContent = buf.toString('utf-8');
        }

        const files: { path: string; content: string }[] = [];
        for (const key of keys) {
          const content = await this.storageService.getObject(orgSlug, key);
          files.push({ path: key, content: content.toString('utf-8') });
        }

        repoWikis.push({ slug: repo.slug, files, indexContent });
      }

      if (repoWikis.length === 0) {
        this.logger.warn(`[${projectSlug}] no wiki files found`);
        await this.reportStatus(projectId, callbackToken, 'error', 'No wiki files found for any repository');
        return;
      }

      const context = this.synthesisImpl.buildContext(repoWikis, existingPages, changedRepos);
      this.logger.log(`[${projectSlug}] calling Anthropic, input ~${context.length} chars`);

      const rawText = await this.synthesisImpl.synthesize(context, anthropicApiKey);
      const { pages, deleteSlugs } = this.synthesisImpl.parseResponse(rawText);

      if (pages.length === 0) {
        throw new Error('No pages found in Claude response');
      }

      this.logger.log(`[${projectSlug}] parsed ${pages.length} pages, ${deleteSlugs.length} deletes`);

      await this.upsertPages(projectId, callbackToken, pages);

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

  private async upsertPages(projectId: string, callbackToken: string, pages: any[]): Promise<void> {
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
