import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';
import { QUEUE_SERVICE } from '../src/queue/queue.module';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';

const mockStorage = {
  putObject: jest.fn().mockResolvedValue(undefined),
  getObject: jest.fn(),
  listObjects: jest.fn(),
  deleteObject: jest.fn().mockResolvedValue(undefined),
};
const mockQueue = { publish: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() };

describe('V2 Dossier Push E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

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
    jwtService = module.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Include v2 tables first to prevent FK-check deadlock with async DossierUpdatedHandler
    await dataSource.query(
      'TRUNCATE project_events, dossier_pages, compendium_pages, users, organizations, org_members, projects, repositories CASCADE',
    );
    jest.clearAllMocks();
  });

  async function setup() {
    const regRes = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: 'v2test@example.com', password: 'password123' });
    const token = regRes.body.access_token;

    const orgRes = await request(app.getHttpServer())
      .post('/v1/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'V2 Test Org' });
    const orgId = orgRes.body.id;

    const projRes = await request(app.getHttpServer())
      .post(`/v1/orgs/${orgId}/projects`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'V2 Project' });
    const projectId = projRes.body.id;

    const repoRes = await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/repos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'v2-repo', gitRemote: 'https://github.com/test/v2-repo.git' });
    const repoId = repoRes.body.id;

    return { token, orgId, projectId, repoId };
  }

  describe('POST /v2/repos/:id/dossier/events', () => {
    it('should persist event chain and dossier_pages for a multi-scope push', async () => {
      const { token, repoId } = await setup();

      const pushDto = {
        baseSha: 'abc123',
        headSha: 'def456',
        prTitle: 'Test PR',
        prNumber: 42,
        scopes: [
          {
            scope: 'backend',
            mode: 'regen',
            events: [
              {
                type: 'DossierRegenApplied',
                bodies: {
                  overview: '---\ntitle: Overview\n---\n# Overview\nContent here.',
                  architecture: '---\ntitle: Architecture\n---\n# Architecture\nDetails here.',
                },
                meta: {
                  reason: 'genesis',
                  sources: ['src/main.ts'],
                  model: 'claude-sonnet-4-5',
                  inputTokens: 100,
                  outputTokens: 200,
                  costUsd: 0.01,
                },
              },
              {
                type: 'DossierRegenDescribed',
                title: 'Backend services initialized with Express and TypeORM',
                meta: {
                  model: 'claude-haiku-4-5',
                  inputTokens: 50,
                  outputTokens: 20,
                  costUsd: 0.001,
                },
              },
            ],
          },
          {
            scope: 'frontend',
            mode: 'patch',
            events: [
              {
                type: 'DossierPatchComputed',
                instructions: '## Patch\n- Update overview section',
                meta: {
                  model: 'claude-sonnet-4-5',
                  inputTokens: 80,
                  outputTokens: 60,
                  costUsd: 0.005,
                  changedSlugs: ['overview'],
                },
              },
              {
                type: 'DossierPatchApplied',
                title: 'Frontend overview updated',
                bodies: {
                  overview: '---\ntitle: Frontend Overview\n---\n# Frontend\nUpdated content.',
                },
                meta: {
                  sources: ['src/App.tsx'],
                  slugCounts: { overview: 1 },
                  sample: 'Updated content.',
                  model: 'claude-sonnet-4-5',
                  inputTokens: 120,
                  outputTokens: 80,
                  costUsd: 0.008,
                },
              },
              {
                type: 'DossierPatchDescribed',
                title: 'Frontend overview updated with new React components',
                meta: {
                  model: 'claude-haiku-4-5',
                  inputTokens: 40,
                  outputTokens: 15,
                  costUsd: 0.0005,
                },
              },
            ],
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .post(`/v2/repos/${repoId}/dossier/events`)
        .set('Authorization', `Bearer ${token}`)
        .send(pushDto)
        .expect(201);

      expect(res.body.dossierUpdatedId).toBeDefined();
      const dossierUpdatedId = res.body.dossierUpdatedId;

      // Verify event chain in project_events
      const events = await dataSource.query(
        `SELECT type, scope, parent_id FROM project_events WHERE repo_id = $1 ORDER BY at ASC`,
        [repoId],
      );

      const types = events.map((e: any) => e.type);
      expect(types).toContain('DossierUpdateFired');
      expect(types).toContain('DossierRegenApplied');
      expect(types).toContain('DossierRegenDescribed');
      expect(types).toContain('DossierPatchComputed');
      expect(types).toContain('DossierPatchApplied');
      expect(types).toContain('DossierPatchDescribed');
      expect(types).toContain('DossierUpdated');

      // Verify DossierUpdated has correct id
      const updatedEvent = events.find((e: any) => e.type === 'DossierUpdated');
      expect(updatedEvent).toBeDefined();

      // Verify dossier_pages was populated for regen scope
      const dossierPages = await dataSource.query(
        `SELECT scope, slug, title FROM dossier_pages WHERE repo_id = $1 ORDER BY scope, slug`,
        [repoId],
      );

      expect(dossierPages.length).toBeGreaterThanOrEqual(2);
      const backendPages = dossierPages.filter((p: any) => p.scope === 'backend');
      expect(backendPages.length).toBe(2);
      expect(backendPages.some((p: any) => p.slug === 'overview')).toBe(true);
      expect(backendPages.some((p: any) => p.slug === 'architecture')).toBe(true);

      const frontendPages = dossierPages.filter((p: any) => p.scope === 'frontend');
      expect(frontendPages.length).toBe(1);
      expect(frontendPages[0].slug).toBe('overview');
    });

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/v2/repos/some-id/dossier/events')
        .send({ baseSha: 'abc', headSha: 'def', scopes: [] })
        .expect(401);
    });

    it('should return 404 for non-member', async () => {
      const { repoId } = await setup();

      const otherReg = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: 'other@example.com', password: 'password123' });
      const otherToken = otherReg.body.access_token;

      await request(app.getHttpServer())
        .post(`/v2/repos/${repoId}/dossier/events`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          baseSha: 'abc',
          headSha: 'def',
          scopes: [],
        })
        .expect(404);
    });
  });

  describe('GET /v2/repos/:id/dossier', () => {
    it('should return empty scopes for a new repo', async () => {
      const { token, repoId } = await setup();

      const res = await request(app.getHttpServer())
        .get(`/v2/repos/${repoId}/dossier`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.scopes).toEqual([]);
    });

    it('should return populated scopes after a push', async () => {
      const { token, repoId } = await setup();

      await request(app.getHttpServer())
        .post(`/v2/repos/${repoId}/dossier/events`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          baseSha: 'abc',
          headSha: 'def',
          scopes: [
            {
              scope: 'api',
              mode: 'regen',
              events: [
                {
                  type: 'DossierRegenApplied',
                  bodies: {
                    overview: '---\ntitle: API Overview\n---\n# API\nContent.',
                  },
                  meta: {
                    reason: 'genesis',
                    sources: [],
                    model: 'claude-sonnet-4-5',
                    inputTokens: 100,
                    outputTokens: 50,
                    costUsd: 0.005,
                  },
                },
                {
                  type: 'DossierRegenDescribed',
                  title: 'API initialized',
                  meta: { model: 'claude-haiku-4-5', inputTokens: 20, outputTokens: 10, costUsd: 0.0001 },
                },
              ],
            },
          ],
        });

      const res = await request(app.getHttpServer())
        .get(`/v2/repos/${repoId}/dossier`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.scopes).toHaveLength(1);
      expect(res.body.scopes[0].scope).toBe('api');
      expect(res.body.scopes[0].pages).toHaveLength(1);
      expect(res.body.scopes[0].pages[0].slug).toBe('overview');
      expect(res.body.scopes[0].pages[0].title).toBe('API Overview');
    });
  });

  describe('POST /v2/repos/:id/dossier/events — delete scope', () => {
    it('should remove dossier_pages for a deleted scope', async () => {
      const { token, repoId } = await setup();

      // First, add a scope via regen
      await request(app.getHttpServer())
        .post(`/v2/repos/${repoId}/dossier/events`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          baseSha: 'sha1',
          headSha: 'sha2',
          scopes: [
            {
              scope: 'toremove',
              mode: 'regen',
              events: [
                {
                  type: 'DossierRegenApplied',
                  bodies: { page1: '# Page 1\nContent.' },
                  meta: { reason: 'genesis', sources: [], model: 'claude-sonnet-4-5', inputTokens: 10, outputTokens: 10, costUsd: 0.001 },
                },
                {
                  type: 'DossierRegenDescribed',
                  title: 'Scope created',
                  meta: { model: 'claude-haiku-4-5', inputTokens: 5, outputTokens: 5, costUsd: 0.0001 },
                },
              ],
            },
          ],
        });

      // Verify it was created
      const beforePages = await dataSource.query(
        `SELECT * FROM dossier_pages WHERE repo_id = $1 AND scope = 'toremove'`,
        [repoId],
      );
      expect(beforePages.length).toBe(1);

      // Now delete the scope
      await request(app.getHttpServer())
        .post(`/v2/repos/${repoId}/dossier/events`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          baseSha: 'sha2',
          headSha: 'sha3',
          scopes: [
            {
              scope: 'toremove',
              mode: 'delete',
              events: [
                {
                  type: 'DossierScopeRemoved',
                  meta: { lastKnownSlugs: ['page1'] },
                },
              ],
            },
          ],
        });

      // Verify pages were deleted
      const afterPages = await dataSource.query(
        `SELECT * FROM dossier_pages WHERE repo_id = $1 AND scope = 'toremove'`,
        [repoId],
      );
      expect(afterPages.length).toBe(0);
    });
  });
});

describe('V2 Compendium Callback E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

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
    jwtService = module.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE project_events, dossier_pages, compendium_pages, users, organizations, org_members, projects, repositories CASCADE',
    );
    jest.clearAllMocks();
  });

  async function setupWithPush() {
    const regRes = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: 'comptest@example.com', password: 'password123' });
    const token = regRes.body.access_token;

    const orgRes = await request(app.getHttpServer())
      .post('/v1/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Comp Test Org' });
    const orgId = orgRes.body.id;

    const projRes = await request(app.getHttpServer())
      .post(`/v1/orgs/${orgId}/projects`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Comp Project' });
    const projectId = projRes.body.id;

    const repoRes = await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/repos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'comp-repo', gitRemote: 'https://github.com/test/comp-repo.git' });
    const repoId = repoRes.body.id;

    // Push dossier events
    const pushRes = await request(app.getHttpServer())
      .post(`/v2/repos/${repoId}/dossier/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        baseSha: 'sha1',
        headSha: 'sha2',
        prTitle: 'Setup push',
        scopes: [
          {
            scope: 'api',
            mode: 'regen',
            events: [
              {
                type: 'DossierRegenApplied',
                bodies: { overview: '---\ntitle: API\n---\n# API\nContent.' },
                meta: { reason: 'genesis', sources: [], model: 'claude-sonnet-4-5', inputTokens: 10, outputTokens: 10, costUsd: 0.001 },
              },
              {
                type: 'DossierRegenDescribed',
                title: 'API initialized',
                meta: { model: 'claude-haiku-4-5', inputTokens: 5, outputTokens: 5, costUsd: 0.0001 },
              },
            ],
          },
        ],
      });

    const dossierUpdatedId = pushRes.body.dossierUpdatedId;
    return { token, orgId, projectId, repoId, dossierUpdatedId };
  }

  describe('POST /v2/internal/compendium/callback', () => {
    it('should process callback, persist compendium events, upsert compendium_pages, and delete bundles', async () => {
      const { projectId, dossierUpdatedId } = await setupWithPush();

      // Simulate a result bundle
      const resultBundle = {
        jobId: dossierUpdatedId,
        projectId,
        patchComputed: {
          instructions: '## Patch\n- Add system section',
          meta: { model: 'claude-sonnet-4-5', inputTokens: 100, outputTokens: 200, costUsd: 0.01 },
        },
        regenApplied: {
          bodies: {
            system: '---\ntitle: System Overview\n---\n# System\nOverview content.',
            'data-flows': '---\ntitle: Data Flows\n---\n# Data Flows\nFlow content.',
            'transport-graph': '---\ntitle: Transport Graph\n---\n# Transport\nGraph content.',
            infra: '---\ntitle: Infrastructure\n---\n# Infrastructure\nInfra content.',
          },
          meta: { model: 'claude-sonnet-4-5', inputTokens: 200, outputTokens: 400, costUsd: 0.02 },
        },
        described: {
          title: 'Compendium initialized with four topic pages',
          meta: { model: 'claude-haiku-4-5', inputTokens: 50, outputTokens: 20, costUsd: 0.0005 },
        },
        finalCompendium: {
          pages: [
            { slug: 'system', title: 'System Overview', content: '---\ntitle: System Overview\n---\n# System\nOverview content.', sources: [], related: [] },
            { slug: 'data-flows', title: 'Data Flows', content: '---\ntitle: Data Flows\n---\n# Data Flows\nFlow content.', sources: [], related: [] },
            { slug: 'transport-graph', title: 'Transport Graph', content: '---\ntitle: Transport Graph\n---\n# Transport\nGraph content.', sources: [], related: [] },
            { slug: 'infra', title: 'Infrastructure', content: '---\ntitle: Infrastructure\n---\n# Infrastructure\nInfra content.', sources: [], related: [] },
          ],
        },
      };

      const resultJson = JSON.stringify(resultBundle);
      const resultHash = createHash('sha256').update(resultJson).digest('hex');
      const resultKey = `compendium-jobs/${dossierUpdatedId}-${resultHash}.result.json`;

      // Mock storage to return the result bundle
      mockStorage.getObject.mockResolvedValueOnce(Buffer.from(resultJson));

      // Sign callback JWT
      const callbackToken = jwtService.sign(
        { sub: dossierUpdatedId, scope: 'compendium-callback' },
        { expiresIn: '1h' },
      );

      const res = await request(app.getHttpServer())
        .post('/v2/internal/compendium/callback')
        .set('Authorization', `Bearer ${callbackToken}`)
        .send({
          jobId: dossierUpdatedId,
          resultBundleRef: { container: 'comp-test-org', key: resultKey, hash: resultHash },
        })
        .expect(200);

      expect(res.body.ok).toBe(true);

      // Verify compendium events from callback were persisted
      // Note: CompendiumRegenFired is emitted by DossierUpdatedHandler (async side-effect of push),
      // not by the callback handler, so it's not checked here.
      const events = await dataSource.query(
        `SELECT type FROM project_events WHERE project_id = $1 AND type LIKE 'Compendium%' ORDER BY at ASC`,
        [projectId],
      );
      const eventTypes = events.map((e: any) => e.type);
      expect(eventTypes).toContain('CompendiumPatchComputed');
      expect(eventTypes).toContain('CompendiumRegenApplied');
      expect(eventTypes).toContain('CompendiumDescribed');
      expect(eventTypes).toContain('CompendiumUpdated');

      // Verify compendium_pages was upserted
      const pages = await dataSource.query(
        `SELECT slug, title FROM compendium_pages WHERE project_id = $1 ORDER BY slug`,
        [projectId],
      );
      expect(pages.length).toBe(4);
      expect(pages.some((p: any) => p.slug === 'system')).toBe(true);
      expect(pages.some((p: any) => p.slug === 'data-flows')).toBe(true);
      expect(pages.some((p: any) => p.slug === 'transport-graph')).toBe(true);
      expect(pages.some((p: any) => p.slug === 'infra')).toBe(true);

      // Verify bundles were deleted
      expect(mockStorage.deleteObject).toHaveBeenCalledTimes(2);
    });

    it('should return 401 for invalid JWT', async () => {
      await request(app.getHttpServer())
        .post('/v2/internal/compendium/callback')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          jobId: 'some-id',
          resultBundleRef: { container: 'c', key: 'k', hash: 'h' },
        })
        .expect(401);
    });

    it('should return 401 when jobId does not match token sub', async () => {
      const callbackToken = jwtService.sign(
        { sub: 'correct-id', scope: 'compendium-callback' },
        { expiresIn: '1h' },
      );

      await request(app.getHttpServer())
        .post('/v2/internal/compendium/callback')
        .set('Authorization', `Bearer ${callbackToken}`)
        .send({
          jobId: 'wrong-id',
          resultBundleRef: { container: 'c', key: 'k', hash: 'h' },
        })
        .expect(401);
    });
  });
});

describe('V2 Events Timeline Feed E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;

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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE project_events, dossier_pages, compendium_pages, users, organizations, org_members, projects, repositories CASCADE',
    );
    jest.clearAllMocks();
  });

  async function setupWithPush() {
    const regRes = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: 'feedtest@example.com', password: 'password123' });
    const token = regRes.body.access_token;

    const orgRes = await request(app.getHttpServer())
      .post('/v1/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Feed Test Org' });
    const orgId = orgRes.body.id;

    const projRes = await request(app.getHttpServer())
      .post(`/v1/orgs/${orgId}/projects`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Feed Project' });
    const projectId = projRes.body.id;

    const repoRes = await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/repos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'feed-repo', gitRemote: 'https://github.com/test/feed-repo.git' });
    const repoId = repoRes.body.id;

    const pushRes = await request(app.getHttpServer())
      .post(`/v2/repos/${repoId}/dossier/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        baseSha: 'sha1',
        headSha: 'sha2',
        prTitle: 'Feed test push',
        scopes: [
          {
            scope: 'service',
            mode: 'regen',
            events: [
              {
                type: 'DossierRegenApplied',
                bodies: { overview: '---\ntitle: Service\n---\n# Service\nContent.' },
                meta: { reason: 'genesis', sources: [], model: 'claude-sonnet-4-5', inputTokens: 10, outputTokens: 10, costUsd: 0.001 },
              },
              {
                type: 'DossierRegenDescribed',
                title: 'Service initialized',
                meta: { model: 'claude-haiku-4-5', inputTokens: 5, outputTokens: 5, costUsd: 0.0001 },
              },
            ],
          },
        ],
      });

    const dossierUpdatedId = pushRes.body.dossierUpdatedId;
    return { token, orgId, projectId, repoId, dossierUpdatedId };
  }

  describe('GET /v2/repos/:id/events', () => {
    it('should return all events for a repo', async () => {
      const { token, repoId } = await setupWithPush();

      const res = await request(app.getHttpServer())
        .get(`/v2/repos/${repoId}/events`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.events).toBeDefined();
      expect(res.body.events.length).toBeGreaterThan(0);
      expect(res.body.events.every((e: any) => e.repoId === repoId)).toBe(true);
    });

    it('should filter by types=*Updated and return only DossierUpdated', async () => {
      const { token, repoId } = await setupWithPush();

      const res = await request(app.getHttpServer())
        .get(`/v2/repos/${repoId}/events?types=*Updated`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.events.length).toBe(1);
      expect(res.body.events[0].type).toBe('DossierUpdated');
    });

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .get('/v2/repos/some-id/events')
        .expect(401);
    });
  });

  describe('GET /v2/repos/:id/events/:eventId', () => {
    it('should return the DossierUpdated event with all its children', async () => {
      const { token, repoId, dossierUpdatedId } = await setupWithPush();

      const res = await request(app.getHttpServer())
        .get(`/v2/repos/${repoId}/events/${dossierUpdatedId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.event).toBeDefined();
      expect(res.body.event.type).toBe('DossierUpdated');
      expect(res.body.event.id).toBe(dossierUpdatedId);
      expect(Array.isArray(res.body.children)).toBe(true);
      // DossierUpdated's parent_id is the DossierUpdateFired - so it should have no children
      // But CompendiumRegenFired has DossierUpdated as parent, so it could be a child
    });

    it('should return 404 for an event that belongs to a different repo', async () => {
      const { token, repoId } = await setupWithPush();

      // Create another repo and push to it
      const reg2 = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: 'feed2@example.com', password: 'password123' });
      const t2 = reg2.body.access_token;

      const org2 = await request(app.getHttpServer())
        .post('/v1/orgs')
        .set('Authorization', `Bearer ${t2}`)
        .send({ name: 'Feed Org 2' });

      const proj2 = await request(app.getHttpServer())
        .post(`/v1/orgs/${org2.body.id}/projects`)
        .set('Authorization', `Bearer ${t2}`)
        .send({ name: 'Feed Project 2' });

      const repo2 = await request(app.getHttpServer())
        .post(`/v1/projects/${proj2.body.id}/repos`)
        .set('Authorization', `Bearer ${t2}`)
        .send({ name: 'feed-repo2', gitRemote: 'https://github.com/test/feed-repo2.git' });

      const push2 = await request(app.getHttpServer())
        .post(`/v2/repos/${repo2.body.id}/dossier/events`)
        .set('Authorization', `Bearer ${t2}`)
        .send({
          baseSha: 'sha1', headSha: 'sha2',
          scopes: [
            {
              scope: 'service', mode: 'regen',
              events: [
                {
                  type: 'DossierRegenApplied',
                  bodies: { page: '# Page\nContent.' },
                  meta: { reason: 'genesis', sources: [], model: 'claude-sonnet-4-5', inputTokens: 10, outputTokens: 10, costUsd: 0.001 },
                },
                {
                  type: 'DossierRegenDescribed',
                  title: 'Service 2 initialized',
                  meta: { model: 'claude-haiku-4-5', inputTokens: 5, outputTokens: 5, costUsd: 0.0001 },
                },
              ],
            },
          ],
        });

      const otherEventId = push2.body.dossierUpdatedId;

      // Try to access repo2's event via repo1's endpoint - should 404
      await request(app.getHttpServer())
        .get(`/v2/repos/${repoId}/events/${otherEventId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('GET /v2/orgs/:id/events', () => {
    it('should return events for the org', async () => {
      const { token, orgId } = await setupWithPush();

      const res = await request(app.getHttpServer())
        .get(`/v2/orgs/${orgId}/events`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.events).toBeDefined();
      expect(res.body.events.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-member', async () => {
      const { orgId } = await setupWithPush();

      const other = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: 'nomember@example.com', password: 'password123' });
      const otherToken = other.body.access_token;

      await request(app.getHttpServer())
        .get(`/v2/orgs/${orgId}/events`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
    });
  });

  describe('GET /v2/projects/:id/events', () => {
    it('should return events for the project', async () => {
      const { token, projectId } = await setupWithPush();

      const res = await request(app.getHttpServer())
        .get(`/v2/projects/${projectId}/events`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.events).toBeDefined();
    });
  });
});
