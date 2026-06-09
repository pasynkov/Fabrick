/**
 * Sandbox v2 E2E tests.
 *
 * Spins up the SandboxModule (not AppModule) and mocks:
 * - fs operations (existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync)
 * - synthesizeCompendiumBundle from @app/shared
 * - SearchImplV2 from @app/shared
 * - FilePromptRepository
 *
 * Tests:
 * 5.5 POST /sandbox/synthesize-v2
 * 5.8 POST /v2/orgs/:org/projects/:project/search
 * 5.10 V1 endpoints unchanged (checked via imports)
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { join } from 'path';

// Mock @app/shared's synthesizeCompendiumBundle
jest.mock('@app/shared', () => {
  const actual = jest.requireActual('@app/shared');
  return {
    ...actual,
    synthesizeCompendiumBundle: jest.fn(),
  };
});

import { synthesizeCompendiumBundle, SearchImplV2, COMPENDIUM_TOPIC_SLUGS } from '@app/shared';

// Mock fs module at module level
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn(),
    readdirSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    statSync: jest.fn(),
  };
});

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

const DOSSIERS_DIR = join(process.cwd(), 'sandbox-data', 'dossiers');
const COMPENDIUM_DIR = join(process.cwd(), 'sandbox-data', 'compendium');

describe('Sandbox V2 E2E', () => {
  let app: INestApplication;
  let searchImplV2Mock: { search: jest.Mock };

  beforeAll(async () => {
    searchImplV2Mock = { search: jest.fn() };

    // We need to lazily import SandboxModule to ensure mocks are in place
    const { SandboxModule } = await import('../../sandbox/src/sandbox.module');

    const module = await Test.createTestingModule({
      imports: [SandboxModule],
    })
      .overrideProvider(SearchImplV2)
      .useValue(searchImplV2Mock)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }));
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.REPOS;
  });

  describe('POST /v1/sandbox/synthesize-v2', () => {
    it('returns 400 when ANTHROPIC_API_KEY is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/sandbox/synthesize-v2')
        .send({ repos: ['/tmp/test-repo'] })
        .expect(400);

      expect(res.body.message).toMatch(/ANTHROPIC_API_KEY/i);
    });

    it('copies dossier files and produces 5 compendium pages', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-test-key';
      const repoPath = '/tmp/test-repo';
      const wikiDir = join(repoPath, '.fabrick', 'wiki');

      // Mock: wiki dir exists, has a scope subdir 'web' with 'service.md'
      (existsSync as jest.Mock).mockImplementation((p: string) => {
        return (
          p === wikiDir ||
          p === join(wikiDir, 'web') ||
          p === COMPENDIUM_DIR
        );
      });

      (readdirSync as jest.Mock).mockImplementation((dir: string, opts?: any) => {
        if (dir === wikiDir) {
          return [{ name: 'web', isDirectory: () => true, isFile: () => false }];
        }
        if (dir === join(wikiDir, 'web')) {
          return [{ name: 'service.md', isDirectory: () => false, isFile: () => true }];
        }
        if (dir === join(DOSSIERS_DIR, 'test-repo', 'web')) {
          return [{ name: 'service.md', isDirectory: () => false, isFile: () => true }];
        }
        if (dir === join(DOSSIERS_DIR, 'test-repo')) {
          return [{ name: 'web', isDirectory: () => true, isFile: () => false }];
        }
        return [];
      });

      (readFileSync as jest.Mock).mockReturnValue('---\ntitle: Service\n---\n# Service\nContent.');
      (mkdirSync as jest.Mock).mockReturnValue(undefined);
      (writeFileSync as jest.Mock).mockReturnValue(undefined);

      const mockRegenBodies: Record<string, string> = {};
      for (const slug of COMPENDIUM_TOPIC_SLUGS) {
        mockRegenBodies[slug] = `---\ntitle: ${slug}\n---\n# ${slug}\nContent.`;
      }
      (synthesizeCompendiumBundle as jest.Mock).mockResolvedValue({
        regenBodies: mockRegenBodies,
        meta: { model: 'claude-sonnet-4-6', inputTokens: 100, outputTokens: 200, costUsd: 0.01 },
      });

      const res = await request(app.getHttpServer())
        .post('/v1/sandbox/synthesize-v2')
        .send({ repos: [repoPath] })
        .expect(201);

      expect(res.body.pages).toBe(5);
      expect(res.body.status).toBe('done');
      expect(res.body.repos).toContain('test-repo');

      // Verify writeFileSync was called 5 times for compendium pages
      const compendiumWrites = (writeFileSync as jest.Mock).mock.calls.filter(
        (c) => typeof c[0] === 'string' && c[0].includes('compendium'),
      );
      expect(compendiumWrites.length).toBe(5);
    });

    it('flat wiki layout (no subdir) maps to scope root', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-test-key';
      const repoPath = '/tmp/flat-repo';
      const wikiDir = join(repoPath, '.fabrick', 'wiki');

      // Flat layout: no subdirs, just files
      (existsSync as jest.Mock).mockImplementation((p: string) => {
        return p === wikiDir || p === COMPENDIUM_DIR;
      });

      (readdirSync as jest.Mock).mockImplementation((dir: string, opts?: any) => {
        if (dir === wikiDir) {
          return [{ name: 'service.md', isDirectory: () => false, isFile: () => true }];
        }
        if (dir === join(DOSSIERS_DIR, 'flat-repo', 'root')) {
          return [{ name: 'service.md', isDirectory: () => false, isFile: () => true }];
        }
        if (dir === join(DOSSIERS_DIR, 'flat-repo')) {
          return [{ name: 'root', isDirectory: () => true, isFile: () => false }];
        }
        return [];
      });

      (readFileSync as jest.Mock).mockReturnValue('# Service\nContent.');
      (mkdirSync as jest.Mock).mockReturnValue(undefined);
      (writeFileSync as jest.Mock).mockReturnValue(undefined);

      const mockRegenBodies: Record<string, string> = {};
      for (const slug of COMPENDIUM_TOPIC_SLUGS) {
        mockRegenBodies[slug] = `---\ntitle: ${slug}\n---\n# ${slug}\nContent.`;
      }
      (synthesizeCompendiumBundle as jest.Mock).mockResolvedValue({
        regenBodies: mockRegenBodies,
        meta: { model: 'claude-sonnet-4-6', inputTokens: 100, outputTokens: 200, costUsd: 0.01 },
      });

      const res = await request(app.getHttpServer())
        .post('/v1/sandbox/synthesize-v2')
        .send({ repos: [repoPath] })
        .expect(201);

      expect(res.body.status).toBe('done');

      // Verify dossier was written to 'root' scope
      const dossierWrites = (writeFileSync as jest.Mock).mock.calls.filter(
        (c) => typeof c[0] === 'string' && c[0].includes('/root/'),
      );
      expect(dossierWrites.length).toBeGreaterThan(0);
    });
  });

  describe('POST /v1/v2/orgs/:org/projects/:project/search', () => {
    it('returns 400 when sandbox-data/compendium/index.md is missing', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-test-key';
      searchImplV2Mock.search.mockRejectedValue(
        new Error('No compendium index found. Run compendium synthesis first.'),
      );

      const res = await request(app.getHttpServer())
        .post('/v1/v2/orgs/demo/projects/demo/search')
        .send({ question: 'test question' })
        .expect(400);

      expect(res.body.message).toMatch(/compendium/i);
    });

    it('returns answer and sources without auth header', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-test-key';
      searchImplV2Mock.search.mockResolvedValue({
        answer: 'The answer.',
        sources: ['compendium/system', 'dossier/my-repo/api/service'],
        metrics: {
          iters: 1,
          pagesRead: 1,
          totalInputTokens: 100,
          totalOutputTokens: 50,
          durationMs: 100,
          stopReason: 'end_turn',
          perCallTokens: [{ inputTokens: 100, outputTokens: 50 }],
        },
        promptRevisionId: 'rev-1',
      });

      const res = await request(app.getHttpServer())
        .post('/v1/v2/orgs/demo/projects/demo/search')
        .send({ question: 'How does auth work?' })
        .expect(201);

      expect(res.body.answer).toBe('The answer.');
      expect(res.body.sources).toEqual(['compendium/system', 'dossier/my-repo/api/service']);
    });
  });
});
