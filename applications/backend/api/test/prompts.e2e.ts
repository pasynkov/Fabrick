import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';
import { QUEUE_SERVICE } from '../src/queue/queue.module';

const mockStorage = { putObject: jest.fn(), getObject: jest.fn(), listObjects: jest.fn() };
const mockQueue = { publish: jest.fn(), subscribe: jest.fn() };

describe('Prompts Admin E2E', () => {
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
      'TRUNCATE users, organizations, org_members, projects, repositories, search_requests, token_usage CASCADE',
    );
    // Seed migration inserts prompt_revisions; we need them for the tests
    // prompt_revisions table is NOT truncated so seed rows persist
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
    return { token, userId };
  }

  describe('Access control', () => {
    it('returns 401 on unauthenticated request to GET /admin/prompts', async () => {
      await request(app.getHttpServer())
        .get('/v1/admin/prompts')
        .expect(401);
    });

    it('returns 403 when non-admin requests GET /admin/prompts', async () => {
      const { token } = await registerUser('user@example.com');
      await request(app.getHttpServer())
        .get('/v1/admin/prompts')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('returns 200 when platform admin requests GET /admin/prompts', async () => {
      const { token } = await setupAdminUser('admin@example.com');
      await request(app.getHttpServer())
        .get('/v1/admin/prompts')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('GET /admin/prompts (list)', () => {
    it('returns list of latest revisions per (name, agent)', async () => {
      const { token } = await setupAdminUser('admin2@example.com');

      const res = await request(app.getHttpServer())
        .get('/v1/admin/prompts')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // Seed migration creates 4 rows: search, synthesis, fabrick-analyze, fabrick-push
      expect(res.body.length).toBeGreaterThanOrEqual(4);
      const item = res.body[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('agent');
      expect(item).toHaveProperty('revision');
      expect(item).toHaveProperty('updatedAt');
    });
  });

  describe('GET /admin/prompts/:name/:agent (detail)', () => {
    it('returns latest revision including content', async () => {
      const { token } = await setupAdminUser('admin3@example.com');

      const res = await request(app.getHttpServer())
        .get('/v1/admin/prompts/search/claude')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.name).toBe('search');
      expect(res.body.agent).toBe('claude');
      expect(res.body.revision).toBe(1);
      expect(res.body.content).toBeDefined();
      expect(res.body.content.files).toHaveProperty(['prompt.md']);
    });

    it('returns 404 for unknown (name, agent)', async () => {
      const { token } = await setupAdminUser('admin4@example.com');

      await request(app.getHttpServer())
        .get('/v1/admin/prompts/nonexistent/claude')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('GET /admin/prompts/:name/:agent/history', () => {
    it('returns revision history newest first without content', async () => {
      const { token, userId } = await setupAdminUser('admin5@example.com');

      // Add a second revision
      await request(app.getHttpServer())
        .post('/v1/admin/prompts/search/claude')
        .set('Authorization', `Bearer ${token}`)
        .send({ files: { 'prompt.md': 'updated prompt' }, note: 'test update' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/v1/admin/prompts/search/claude/history')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      // Newest first
      expect(res.body[0].revision).toBeGreaterThan(res.body[1].revision);
      // No content in history listing
      expect(res.body[0].content).toBeUndefined();
    });
  });

  describe('GET /admin/prompts/:name/:agent/:revision', () => {
    it('returns full row for specified revision', async () => {
      const { token } = await setupAdminUser('admin6@example.com');

      const res = await request(app.getHttpServer())
        .get('/v1/admin/prompts/search/claude/1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.revision).toBe(1);
      expect(res.body.content).toBeDefined();
    });

    it('returns 404 for unknown revision', async () => {
      const { token } = await setupAdminUser('admin7@example.com');

      await request(app.getHttpServer())
        .get('/v1/admin/prompts/search/claude/9999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('POST /admin/prompts/:name/:agent', () => {
    it('creates a new revision starting at 1 for a brand-new (name, agent)', async () => {
      const { token } = await setupAdminUser('admin8@example.com');

      const res = await request(app.getHttpServer())
        .post('/v1/admin/prompts/brand-new-prompt/claude')
        .set('Authorization', `Bearer ${token}`)
        .send({ files: { 'prompt.md': 'hello world' } })
        .expect(201);

      expect(res.body.revision).toBe(1);
      expect(res.body.id).toBeDefined();
    });

    it('creates MAX+1 revision when prior revisions exist for (name, agent)', async () => {
      const { token } = await setupAdminUser('admin9@example.com');

      // Get current revision first
      const currentRes = await request(app.getHttpServer())
        .get('/v1/admin/prompts/search/claude')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const currentRevision = currentRes.body.revision;

      const res = await request(app.getHttpServer())
        .post('/v1/admin/prompts/search/claude')
        .set('Authorization', `Bearer ${token}`)
        .send({ files: { 'prompt.md': 'updated prompt' } })
        .expect(201);

      expect(res.body.revision).toBe(currentRevision + 1);
    });

    it('returns 400 when files is empty', async () => {
      const { token } = await setupAdminUser('admin10@example.com');

      await request(app.getHttpServer())
        .post('/v1/admin/prompts/search/claude')
        .set('Authorization', `Bearer ${token}`)
        .send({ files: {} })
        .expect(400);
    });

    it('returns 400 when body is invalid (missing files)', async () => {
      const { token } = await setupAdminUser('admin11@example.com');

      await request(app.getHttpServer())
        .post('/v1/admin/prompts/search/claude')
        .set('Authorization', `Bearer ${token}`)
        .send({ note: 'no files here' })
        .expect(400);
    });

    it('returns 403 for non-admin', async () => {
      const { token } = await registerUser('nonadmin@example.com');

      await request(app.getHttpServer())
        .post('/v1/admin/prompts/search/claude')
        .set('Authorization', `Bearer ${token}`)
        .send({ files: { 'prompt.md': 'x' } })
        .expect(403);
    });
  });
});
