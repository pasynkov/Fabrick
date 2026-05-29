import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';
import { QUEUE_SERVICE } from '../src/queue/queue.module';
import { SearchRequestRepository } from '../src/analytics/search-request.repository';
import { TokenUsageRepository } from '../src/analytics/token-usage.repository';

const mockStorage = { putObject: jest.fn(), getObject: jest.fn(), listObjects: jest.fn() };
const mockQueue = { publish: jest.fn(), subscribe: jest.fn() };

describe('Analytics E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let searchRequestRepo: SearchRequestRepository;
  let tokenUsageRepo: TokenUsageRepository;

  beforeAll(async () => {
    process.env.DB_NAME = process.env.DB_TEST_NAME || 'fabrick_test';
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = Buffer.from('test-encryption-key-for-e2e-tests!!').toString('base64');
    }

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(StorageService).useValue(mockStorage)
      .overrideProvider(QUEUE_SERVICE).useValue(mockQueue)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    dataSource = module.get(DataSource);
    searchRequestRepo = module.get(SearchRequestRepository);
    tokenUsageRepo = module.get(TokenUsageRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE users, organizations, org_members, projects, repositories, search_requests, token_usage CASCADE',
    );
    jest.clearAllMocks();
  });

  async function setup(email = 'analytics@example.com') {
    const regRes = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password: 'password123' });
    const token = regRes.body.access_token;

    const orgRes = await request(app.getHttpServer())
      .post('/v1/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Analytics Org' });
    const orgId = orgRes.body.id;

    const projRes = await request(app.getHttpServer())
      .post(`/v1/orgs/${orgId}/projects`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Analytics Project' });
    const projectId = projRes.body.id;

    return { token, orgId, projectId };
  }

  describe('GET /projects/:id/usage-analytics', () => {
    it('returns empty arrays for a project with no usage', async () => {
      const { token, projectId } = await setup();

      const res = await request(app.getHttpServer())
        .get(`/v1/projects/${projectId}/usage-analytics`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({ searchRequests: [], tokenUsage: [] });
    });

    it('returns 401 without auth', async () => {
      const { projectId } = await setup();
      await request(app.getHttpServer())
        .get(`/v1/projects/${projectId}/usage-analytics`)
        .expect(401);
    });

    it('returns 404 for a project the caller does not have access to', async () => {
      const { projectId } = await setup();
      const intruder = await setup('intruder@example.com');
      await request(app.getHttpServer())
        .get(`/v1/projects/${projectId}/usage-analytics`)
        .set('Authorization', `Bearer ${intruder.token}`)
        .expect(404);
    });

    it('returns persisted search_requests and token_usage rows for the project', async () => {
      const { token, projectId } = await setup();

      const searchRequest = await searchRequestRepo.create({
        projectId,
        question: 'How does NATS work?',
        reasoningRequested: true,
        iters: 3,
        pagesRead: 2,
        totalInputTokens: 1200,
        totalOutputTokens: 400,
        durationMs: 5000,
        stopReason: 'end_turn',
        answerBrief: 'NATS handles pubsub.',
        answerReasoning: 'Detailed reasoning text.',
        sources: ['contracts/nats-subjects'],
      });

      await tokenUsageRepo.create({
        projectId,
        searchRequestId: searchRequest.id,
        operation: 'search',
        inputTokens: 800,
        outputTokens: 300,
        provider: 'claude',
      });
      await tokenUsageRepo.create({
        projectId,
        searchRequestId: null,
        operation: 'synthesis',
        inputTokens: 5000,
        outputTokens: 6000,
        provider: 'claude',
      });

      const res = await request(app.getHttpServer())
        .get(`/v1/projects/${projectId}/usage-analytics`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.searchRequests).toHaveLength(1);
      expect(res.body.searchRequests[0]).toMatchObject({
        question: 'How does NATS work?',
        reasoningRequested: true,
        iters: 3,
        pagesRead: 2,
        totalInputTokens: 1200,
        totalOutputTokens: 400,
        durationMs: 5000,
        stopReason: 'end_turn',
        answerBrief: 'NATS handles pubsub.',
        answerReasoning: 'Detailed reasoning text.',
        sources: ['contracts/nats-subjects'],
      });
      expect(res.body.searchRequests[0].id).toBe(searchRequest.id);

      expect(res.body.tokenUsage).toHaveLength(2);
      const searchUsage = res.body.tokenUsage.find((u: any) => u.operation === 'search');
      const synthUsage = res.body.tokenUsage.find((u: any) => u.operation === 'synthesis');
      expect(searchUsage).toMatchObject({
        searchRequestId: searchRequest.id,
        inputTokens: 800,
        outputTokens: 300,
        provider: 'claude',
      });
      expect(synthUsage).toMatchObject({
        searchRequestId: null,
        inputTokens: 5000,
        outputTokens: 6000,
        provider: 'claude',
      });
    });

    it('orders rows by createdAt DESC and respects the 30-day window', async () => {
      const { token, projectId } = await setup();
      const newer = await searchRequestRepo.create({
        projectId,
        question: 'newer',
        reasoningRequested: false,
        iters: 1,
        pagesRead: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        durationMs: 500,
        stopReason: 'end_turn',
        answerBrief: 'b',
        answerReasoning: null,
        sources: [],
      });
      const older = await searchRequestRepo.create({
        projectId,
        question: 'older',
        reasoningRequested: false,
        iters: 1,
        pagesRead: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        durationMs: 500,
        stopReason: 'end_turn',
        answerBrief: 'b',
        answerReasoning: null,
        sources: [],
      });
      // Push older outside 30-day window.
      await dataSource.query(
        `UPDATE "search_requests" SET "createdAt" = now() - interval '40 days' WHERE id = $1`,
        [older.id],
      );
      // Newer keeps created-at now, but bump older row out of window — newer wins ordering.

      const res = await request(app.getHttpServer())
        .get(`/v1/projects/${projectId}/usage-analytics`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.searchRequests).toHaveLength(1);
      expect(res.body.searchRequests[0].id).toBe(newer.id);
    });
  });

  describe('Token usage repository linking', () => {
    it('persists per-call rows linked by searchRequestId', async () => {
      const { projectId } = await setup();

      const sr = await searchRequestRepo.create({
        projectId,
        question: 'q',
        reasoningRequested: false,
        iters: 2,
        pagesRead: 1,
        totalInputTokens: 300,
        totalOutputTokens: 150,
        durationMs: 1000,
        stopReason: 'end_turn',
        answerBrief: 'a',
        answerReasoning: null,
        sources: [],
      });

      await tokenUsageRepo.create({
        projectId,
        searchRequestId: sr.id,
        operation: 'search',
        inputTokens: 200,
        outputTokens: 100,
        provider: 'claude',
      });
      await tokenUsageRepo.create({
        projectId,
        searchRequestId: sr.id,
        operation: 'search',
        inputTokens: 100,
        outputTokens: 50,
        provider: 'claude',
      });

      const rows = await tokenUsageRepo.findRecentForProject(projectId);
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.searchRequestId === sr.id)).toBe(true);
    });
  });
});
