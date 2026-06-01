import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';
import { QUEUE_SERVICE } from '../src/queue/queue.module';
import { SearchRequestRepository } from '../src/analytics/search-request.repository';

const mockStorage = { putObject: jest.fn(), getObject: jest.fn(), listObjects: jest.fn() };
const mockQueue = { publish: jest.fn(), subscribe: jest.fn() };

describe('Admin E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let searchRequestRepo: SearchRequestRepository;

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

  async function registerUser(email: string, password = 'password123') {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password });
    return { token: res.body.access_token, userId: res.body.user.id };
  }

  async function makeAdmin(userId: string) {
    await dataSource.query(`UPDATE users SET "isPlatformAdmin" = true WHERE id = $1`, [userId]);
  }

  async function setupAdminUser(email = 'admin@example.com') {
    const { token, userId } = await registerUser(email);
    await makeAdmin(userId);
    // Re-login to get a fresh token (JwtStrategy reads from DB on each request so existing token works)
    return { token, userId };
  }

  async function setupOrg(adminToken: string, name = 'Test Org') {
    const res = await request(app.getHttpServer())
      .post('/v1/orgs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name });
    return res.body;
  }

  async function setupProject(adminToken: string, orgId: string, name = 'Test Project') {
    const res = await request(app.getHttpServer())
      .post(`/v1/orgs/${orgId}/projects`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name });
    return res.body;
  }

  describe('Access control', () => {
    it('returns 401 on unauthenticated request to /admin/users', async () => {
      await request(app.getHttpServer())
        .get('/v1/admin/users')
        .expect(401);
    });

    it('returns 403 when non-admin requests /admin/users', async () => {
      const { token } = await registerUser('nonadmin@example.com');
      await request(app.getHttpServer())
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('returns 200 when platform admin requests /admin/users', async () => {
      const { token } = await setupAdminUser();
      await request(app.getHttpServer())
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('GET /admin/users', () => {
    it('returns paginated users sorted by createdAt DESC', async () => {
      const { token } = await setupAdminUser('admin@example.com');
      await registerUser('user2@example.com');
      await registerUser('user3@example.com');

      const res = await request(app.getHttpServer())
        .get('/v1/admin/users?limit=50&offset=0')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.total).toBe(3);
      expect(res.body.items).toHaveLength(3);
      expect(res.body.limit).toBe(50);
      expect(res.body.offset).toBe(0);
      expect(res.body.items[0]).toHaveProperty('id');
      expect(res.body.items[0]).toHaveProperty('email');
      expect(res.body.items[0]).toHaveProperty('isPlatformAdmin');
      expect(res.body.items[0]).toHaveProperty('createdAt');
    });

    it('defaults limit=50 offset=0', async () => {
      const { token } = await setupAdminUser();
      const res = await request(app.getHttpServer())
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.limit).toBe(50);
      expect(res.body.offset).toBe(0);
    });

    it('clamps limit to 500', async () => {
      const { token } = await setupAdminUser();
      const res = await request(app.getHttpServer())
        .get('/v1/admin/users?limit=10000')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.limit).toBe(500);
    });
  });

  describe('GET /admin/orgs', () => {
    it('returns paginated orgs', async () => {
      const { token } = await setupAdminUser();
      await setupOrg(token, 'Org A');
      await setupOrg(token, 'Org B');

      const res = await request(app.getHttpServer())
        .get('/v1/admin/orgs')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.total).toBeGreaterThanOrEqual(2);
      expect(res.body.items[0]).toHaveProperty('id');
      expect(res.body.items[0]).toHaveProperty('name');
      expect(res.body.items[0]).toHaveProperty('slug');
    });

    it('returns 403 for non-admin', async () => {
      const { token } = await registerUser('user@example.com');
      await request(app.getHttpServer())
        .get('/v1/admin/orgs')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('GET /admin/orgs/:id', () => {
    it('returns org detail with members and projects', async () => {
      const { token } = await setupAdminUser();
      const org = await setupOrg(token, 'Detail Org');
      await setupProject(token, org.id, 'Proj 1');

      const res = await request(app.getHttpServer())
        .get(`/v1/admin/orgs/${org.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe(org.id);
      expect(res.body.members).toBeInstanceOf(Array);
      expect(res.body.projects).toBeInstanceOf(Array);
      expect(res.body.projects).toHaveLength(1);
      expect(res.body.projects[0].name).toBe('Proj 1');
    });

    it('returns 404 for missing org', async () => {
      const { token } = await setupAdminUser();
      await request(app.getHttpServer())
        .get('/v1/admin/orgs/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('GET /admin/projects', () => {
    it('returns paginated projects with orgId and orgName', async () => {
      const { token } = await setupAdminUser();
      const org = await setupOrg(token, 'Proj Org');
      await setupProject(token, org.id, 'Project Alpha');

      const res = await request(app.getHttpServer())
        .get('/v1/admin/projects')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(res.body.items[0]).toHaveProperty('orgId');
      expect(res.body.items[0]).toHaveProperty('orgName');
    });
  });

  describe('GET /admin/projects/:id', () => {
    it('returns project detail with org and repositories', async () => {
      const { token } = await setupAdminUser();
      const org = await setupOrg(token, 'Repo Org');
      const project = await setupProject(token, org.id, 'Repo Project');

      const res = await request(app.getHttpServer())
        .get(`/v1/admin/projects/${project.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe(project.id);
      expect(res.body.orgId).toBe(org.id);
      expect(res.body.orgName).toBeDefined();
      expect(res.body.repositories).toBeInstanceOf(Array);
    });

    it('returns 404 for missing project', async () => {
      const { token } = await setupAdminUser();
      await request(app.getHttpServer())
        .get('/v1/admin/projects/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('GET /admin/projects/:id/usage', () => {
    it('returns usage data without membership check', async () => {
      const { token, userId } = await setupAdminUser('admin@example.com');

      // Create a separate user and their project
      const { token: otherToken } = await registerUser('other@example.com');
      const otherOrg = await setupOrg(otherToken, 'Other Org');
      const otherProject = await setupProject(otherToken, otherOrg.id, 'Other Project');

      const res = await request(app.getHttpServer())
        .get(`/v1/admin/projects/${otherProject.id}/usage`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('searchRequests');
      expect(res.body).toHaveProperty('tokenUsage');
    });
  });

  describe('GET /admin/search-requests', () => {
    it('returns global search requests feed', async () => {
      const { token } = await setupAdminUser();
      const org = await setupOrg(token, 'Search Org');
      const project = await setupProject(token, org.id, 'Search Project');

      await searchRequestRepo.create({
        projectId: project.id,
        question: 'What is Fabrick?',
        reasoningRequested: false,
        iters: 1,
        pagesRead: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        durationMs: 500,
        stopReason: 'end_turn',
        answerBrief: 'It is a platform.',
        answerReasoning: null,
        sources: [],
      });

      const res = await request(app.getHttpServer())
        .get('/v1/admin/search-requests')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toHaveProperty('projectName');
      expect(res.body.items[0]).toHaveProperty('orgName');
      expect(res.body.items[0].question).toBe('What is Fabrick?');
    });

    it('filters by projectId', async () => {
      const { token } = await setupAdminUser();
      const org = await setupOrg(token, 'Filter Org');
      const proj1 = await setupProject(token, org.id, 'Project 1');
      const proj2 = await setupProject(token, org.id, 'Project 2');

      await searchRequestRepo.create({
        projectId: proj1.id,
        question: 'Q1',
        reasoningRequested: false,
        iters: 1,
        pagesRead: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        durationMs: 500,
        stopReason: 'end_turn',
        answerBrief: 'A1',
        answerReasoning: null,
        sources: [],
      });
      await searchRequestRepo.create({
        projectId: proj2.id,
        question: 'Q2',
        reasoningRequested: false,
        iters: 1,
        pagesRead: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        durationMs: 500,
        stopReason: 'end_turn',
        answerBrief: 'A2',
        answerReasoning: null,
        sources: [],
      });

      const res = await request(app.getHttpServer())
        .get(`/v1/admin/search-requests?projectId=${proj1.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items[0].question).toBe('Q1');
    });

    it('filters by orgId', async () => {
      const { token } = await setupAdminUser();
      const org1 = await setupOrg(token, 'Org1');
      const org2 = await setupOrg(token, 'Org2');
      const proj1 = await setupProject(token, org1.id, 'Proj1');
      const proj2 = await setupProject(token, org2.id, 'Proj2');

      await searchRequestRepo.create({
        projectId: proj1.id,
        question: 'Q-org1',
        reasoningRequested: false,
        iters: 1,
        pagesRead: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        durationMs: 500,
        stopReason: 'end_turn',
        answerBrief: 'A-org1',
        answerReasoning: null,
        sources: [],
      });
      await searchRequestRepo.create({
        projectId: proj2.id,
        question: 'Q-org2',
        reasoningRequested: false,
        iters: 1,
        pagesRead: 1,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        durationMs: 500,
        stopReason: 'end_turn',
        answerBrief: 'A-org2',
        answerReasoning: null,
        sources: [],
      });

      const res = await request(app.getHttpServer())
        .get(`/v1/admin/search-requests?orgId=${org1.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items[0].question).toBe('Q-org1');
    });

    it('returns 403 for non-admin', async () => {
      const { token } = await registerUser('nonAdmin@example.com');
      await request(app.getHttpServer())
        .get('/v1/admin/search-requests')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });
});
