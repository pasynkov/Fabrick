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
