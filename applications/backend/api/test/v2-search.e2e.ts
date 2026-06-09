import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';
import { QUEUE_SERVICE } from '../src/queue/queue.module';
import { SearchImplV2 } from '@app/shared';
import { randomUUID } from 'crypto';

const uniq = () => randomUUID().slice(0, 8);

const mockStorage = {
  putObject: jest.fn().mockResolvedValue(undefined),
  getObject: jest.fn(),
  listObjects: jest.fn(),
  deleteObject: jest.fn().mockResolvedValue(undefined),
};
const mockQueue = { publish: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() };

describe('POST /v2/projects/:id/search', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let searchImplV2Mock: { search: jest.Mock };

  beforeAll(async () => {
    process.env.DB_NAME = process.env.DB_TEST_NAME || 'fabrick_test';
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = Buffer.from('test-encryption-key-for-e2e-tests!!').toString('base64');
    }

    searchImplV2Mock = {
      search: jest.fn().mockResolvedValue({
        answer: 'Test answer',
        sources: ['compendium/system', 'dossier/my-repo/api/service'],
        metrics: {
          iters: 2,
          pagesRead: 2,
          totalInputTokens: 500,
          totalOutputTokens: 200,
          durationMs: 1000,
          stopReason: 'end_turn',
          perCallTokens: [
            { inputTokens: 300, outputTokens: 100 },
            { inputTokens: 200, outputTokens: 100 },
          ],
        },
        promptRevisionId: null,
      }),
    };

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(StorageService).useValue(mockStorage)
      .overrideProvider(QUEUE_SERVICE).useValue(mockQueue)
      .overrideProvider(SearchImplV2).useValue(searchImplV2Mock)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    dataSource = module.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    searchImplV2Mock.search.mockResolvedValue({
      answer: 'Test answer',
      sources: ['compendium/system', 'dossier/my-repo/api/service'],
      metrics: {
        iters: 2,
        pagesRead: 2,
        totalInputTokens: 500,
        totalOutputTokens: 200,
        durationMs: 1000,
        stopReason: 'end_turn',
        perCallTokens: [
          { inputTokens: 300, outputTokens: 100 },
          { inputTokens: 200, outputTokens: 100 },
        ],
      },
      promptRevisionId: null,
    });
  });

  async function setup() {
    const sfx = uniq();
    const regRes = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: `v2search-${sfx}@example.com`, password: 'password123' });
    const token = regRes.body.access_token;

    const orgRes = await request(app.getHttpServer())
      .post('/v1/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `V2Search Org ${sfx}` });
    const orgId = orgRes.body.id;

    // Set API key at org level
    await request(app.getHttpServer())
      .patch(`/v1/orgs/${orgId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ anthropicApiKey: 'sk-ant-test-key-v2-search' });

    const projRes = await request(app.getHttpServer())
      .post(`/v1/orgs/${orgId}/projects`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `V2Search Project ${sfx}` });
    const projectId = projRes.body.id;

    return { token, orgId, projectId };
  }

  describe('authenticated member success path', () => {
    it('returns answer and sources, persists search_requests and token_usage rows', async () => {
      const { token, projectId } = await setup();

      const res = await request(app.getHttpServer())
        .post(`/v2/projects/${projectId}/search`)
        .set('Authorization', `Bearer ${token}`)
        .send({ question: 'How does auth work?' })
        .expect(200);

      expect(res.body.answer).toBe('Test answer');
      expect(res.body.sources).toEqual(['compendium/system', 'dossier/my-repo/api/service']);

      // Verify search_requests row (TypeORM uses camelCase column names by default)
      const searchRequests = await dataSource.query(
        `SELECT * FROM search_requests WHERE "projectId" = $1`,
        [projectId],
      );
      expect(searchRequests.length).toBe(1);
      expect(searchRequests[0].projectId).toBe(projectId);

      // Verify token_usage rows (2 perCallTokens)
      const tokenUsage = await dataSource.query(
        `SELECT * FROM token_usage WHERE "projectId" = $1 ORDER BY "createdAt" ASC`,
        [projectId],
      );
      expect(tokenUsage.length).toBe(2);
      expect(tokenUsage[0].operation).toBe('search');
    });
  });

  describe('missing API key returns 400', () => {
    it('returns 400 when no API key configured', async () => {
      const sfx = uniq();
      const regRes = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: `v2search-nokey-${sfx}@example.com`, password: 'password123' });
      const token = regRes.body.access_token;

      const orgRes = await request(app.getHttpServer())
        .post('/v1/orgs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `V2Search NoKey Org ${sfx}` });
      const orgId = orgRes.body.id;

      const projRes = await request(app.getHttpServer())
        .post(`/v1/orgs/${orgId}/projects`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `V2Search NoKey Project ${sfx}` });
      const projectId = projRes.body.id;

      const res = await request(app.getHttpServer())
        .post(`/v2/projects/${projectId}/search`)
        .set('Authorization', `Bearer ${token}`)
        .send({ question: 'How does auth work?' })
        .expect(400);

      expect(res.body.message).toMatch(/api key/i);
    });
  });

  describe('non-member returns 404', () => {
    it('returns 404 when user is not a member', async () => {
      const { projectId } = await setup();

      // Register a different user
      const sfx2 = uniq();
      const otherReg = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: `other-v2-${sfx2}@example.com`, password: 'password123' });
      const otherToken = otherReg.body.access_token;

      await request(app.getHttpServer())
        .post(`/v2/projects/${projectId}/search`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ question: 'How does auth work?' })
        .expect(404);
    });
  });

  describe('missing compendium index returns 400', () => {
    it('returns 400 when SearchImplV2 throws no compendium index error', async () => {
      const { token, projectId } = await setup();

      searchImplV2Mock.search.mockRejectedValueOnce(
        new Error('No compendium index found. Run compendium synthesis first.'),
      );

      const res = await request(app.getHttpServer())
        .post(`/v2/projects/${projectId}/search`)
        .set('Authorization', `Bearer ${token}`)
        .send({ question: 'How does auth work?' })
        .expect(400);

      expect(res.body.message).toMatch(/compendium/i);
    });
  });

  describe('requires auth', () => {
    it('returns 401 without auth header', async () => {
      await request(app.getHttpServer())
        .post('/v2/projects/some-id/search')
        .send({ question: 'test' })
        .expect(401);
    });
  });
});
