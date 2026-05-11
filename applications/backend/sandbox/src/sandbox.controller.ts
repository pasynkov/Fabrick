import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as unzipper from 'unzipper';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { SynthesisImpl, SearchImpl, RepoWikiInput } from '@app/shared';
import { FsWikiRepository } from './fs-wiki.repository';

const BLOBS_DIR = join(process.cwd(), 'sandbox-data', 'blobs');
const PROJECT_ID = 'sandbox';

@Controller({ version: '1' })
export class SandboxController {
  private readonly logger = new Logger(SandboxController.name);

  constructor(
    private readonly synthesisImpl: SynthesisImpl,
    private readonly searchImpl: SearchImpl,
    private readonly wikiRepo: FsWikiRepository,
  ) {}

  // CLI push
  @Post('repos/:repoId/context')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadContext(
    @Param('repoId') repoId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<void> {
    if (!file) throw new BadRequestException('file field is required');

    const destDir = join(BLOBS_DIR, repoId, 'wiki');
    mkdirSync(destDir, { recursive: true });

    const directory = await unzipper.Open.buffer(file.buffer);
    for (const entry of directory.files) {
      if (entry.type === 'File') {
        const content = await entry.buffer();
        const filePath = join(destDir, entry.path);
        mkdirSync(join(filePath, '..'), { recursive: true });
        writeFileSync(filePath, content);
      }
    }

    this.logger.log(`Uploaded wiki for repo: ${repoId}`);
  }

  // CLI project settings check — return safe defaults so CLI doesn't ask about synthesis
  @Get('projects/:projectId')
  getProjectSettings(@Param('projectId') _projectId: string) {
    return { autoSynthesisEnabled: false, hasApiKey: false };
  }

  // Manual synthesis trigger — runs synchronously
  @Post('sandbox/synthesize')
  async synthesize(): Promise<{ pages: number; status: string }> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new BadRequestException('ANTHROPIC_API_KEY env var is required');

    if (!existsSync(BLOBS_DIR)) {
      throw new BadRequestException('No blobs directory found. Push wikis first.');
    }

    // Load all repo wikis from filesystem
    const repoDirs = readdirSync(BLOBS_DIR).filter((d) => {
      try { return statSync(join(BLOBS_DIR, d)).isDirectory(); } catch { return false; }
    });

    const repoWikis: RepoWikiInput[] = [];
    for (const repoSlug of repoDirs) {
      const wikiDir = join(BLOBS_DIR, repoSlug, 'wiki');
      if (!existsSync(wikiDir)) continue;

      const files = this.walkFiles(wikiDir).map((filePath) => ({
        path: filePath,
        content: readFileSync(filePath, 'utf-8'),
      }));

      if (files.length === 0) continue;

      const indexFile = files.find((f) => f.path.endsWith('/index.md') || f.path.endsWith('\\index.md'));
      repoWikis.push({
        slug: repoSlug,
        files,
        indexContent: indexFile?.content,
      });
    }

    if (repoWikis.length === 0) {
      throw new BadRequestException('No wiki files found in sandbox-data/blobs/. Push wikis first.');
    }

    const existingPages = await this.wikiRepo.findByProject(PROJECT_ID);
    const changedRepos = repoWikis.map((r) => r.slug);

    const context = this.synthesisImpl.buildContext(repoWikis, existingPages, changedRepos);
    this.logger.log(`Synthesizing, context ~${context.length} chars`);

    const rawText = await this.synthesisImpl.synthesize(context, apiKey);
    const { pages, deleteSlugs } = this.synthesisImpl.parseResponse(rawText);

    if (pages.length === 0) {
      throw new BadRequestException('No pages generated. Check synthesis output.');
    }

    await this.wikiRepo.upsert(PROJECT_ID, pages);

    if (deleteSlugs.length > 0) {
      await this.wikiRepo.delete(PROJECT_ID, deleteSlugs);
    }

    this.logger.log(`Synthesis done: ${pages.length} pages, ${deleteSlugs.length} deletes`);
    return { pages: pages.length, status: 'done' };
  }

  // MCP search
  @Post('orgs/:org/projects/:project/search')
  async search(
    @Param('org') _org: string,
    @Param('project') _project: string,
    @Body() body: { question: string },
  ): Promise<{ answer: string; sources: string[] }> {
    if (!body?.question) throw new BadRequestException('question is required');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new BadRequestException('ANTHROPIC_API_KEY env var is required');

    return this.searchImpl.search(PROJECT_ID, body.question, apiKey);
  }

  // MCP tool description
  @Get('orgs/:org/projects/:project/synthesis/file')
  async getSynthesisFile(
    @Param('org') _org: string,
    @Param('project') _project: string,
    @Query('path') path: string,
  ): Promise<string> {
    if (!path) throw new BadRequestException('path query param is required');

    const page = await this.wikiRepo.findBySlug(PROJECT_ID, path);
    if (!page) throw new BadRequestException(`Page not found: ${path}`);
    return page.content;
  }

  private walkFiles(dir: string, results: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        this.walkFiles(full, results);
      } else if (entry.isFile()) {
        results.push(full);
      }
    }
    return results;
  }
}
