import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';
import { QUEUE_SERVICE } from '../src/queue/queue.module';

const mockStorage = { putObject: jest.fn(), getObject: jest.fn(), listObjects: jest.fn() };
const mockQueue = { publish: jest.fn(), subscribe: jest.fn() };

async function registerAndGetToken(server: any, email: string): Promise<string> {
  const res = await request(server)
    .post('/auth/register')
    .send({ email, password: 'password123' });
  return res.body.access_token;
}

describe('Orgs E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    process.env.DB_NAME = process.env.DB_TEST_NAME || 'fabrick_test';

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(StorageService).useValue(mockStorage)
      .overrideProvider(QUEUE_SERVICE).useValue(mockQueue)
      .compile();

    app = module.createNestApplication();
    await app.init();
    dataSource = module.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users, organizations, org_members, projects, repositories CASCADE');
  });

  describe('POST /orgs', () => {
    it('creates org and returns id/name/slug', async () => {
      const token = await registerAndGetToken(app.getHttpServer(), 'user@example.com');

      const res = await request(app.getHttpServer())
        .post('/orgs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My Company' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('My Company');
      expect(res.body.slug).toBeDefined();
    });

    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/orgs')
        .send({ name: 'Unauthorized Org' })
        .expect(401);
    });
  });

  describe('PATCH /orgs/:orgId', () => {
    it('admin can rename org and slug does not change', async () => {
      const token = await registerAndGetToken(app.getHttpServer(), 'rename@example.com');

      const orgRes = await request(app.getHttpServer())
        .post('/orgs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Old Name' })
        .expect(201);

      const orgId = orgRes.body.id;
      const originalSlug = orgRes.body.slug;

      const res = await request(app.getHttpServer())
        .patch(`/orgs/${orgId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name' })
        .expect(200);

      expect(res.body.name).toBe('New Name');
      expect(res.body.slug).toBe(originalSlug);
    });

    it('non-admin cannot rename org (403)', async () => {
      const adminToken = await registerAndGetToken(app.getHttpServer(), 'admin-rename@example.com');
      const memberToken = await registerAndGetToken(app.getHttpServer(), 'member-rename@example.com');

      const orgRes = await request(app.getHttpServer())
        .post('/orgs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Org' })
        .expect(201);
      const orgId = orgRes.body.id;

      await request(app.getHttpServer())
        .post(`/orgs/${orgId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'member-rename@example.com', password: 'password123' });

      await request(app.getHttpServer())
        .patch(`/orgs/${orgId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Hacked Name' })
        .expect(403);
    });

    it('rejects empty name (400)', async () => {
      const token = await registerAndGetToken(app.getHttpServer(), 'emptyname@example.com');
      const orgRes = await request(app.getHttpServer())
        .post('/orgs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My Org' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/orgs/${orgRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' })
        .expect(400);
    });

    it('rejects name over 128 chars (400)', async () => {
      const token = await registerAndGetToken(app.getHttpServer(), 'longname@example.com');
      const orgRes = await request(app.getHttpServer())
        .post('/orgs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My Org' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/orgs/${orgRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'A'.repeat(129) })
        .expect(400);
    });
  });

  describe('GET /orgs', () => {
    it('returns orgs for authenticated user', async () => {
      const token = await registerAndGetToken(app.getHttpServer(), 'user2@example.com');

      const res = await request(app.getHttpServer())
        .get('/orgs')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // register creates personal org
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .get('/orgs')
        .expect(401);
    });
  });
});
