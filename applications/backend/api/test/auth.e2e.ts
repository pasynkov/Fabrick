import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';
import { QUEUE_SERVICE } from '../src/queue/queue.module';

const mockStorage = { putObject: jest.fn(), getObject: jest.fn(), listObjects: jest.fn() };
const mockQueue = { publish: jest.fn(), subscribe: jest.fn() };

describe('Auth E2E', () => {
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

  describe('POST /auth/register', () => {
    it('returns 201 with access_token, refresh_token and user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.user.id).toBeDefined();
    });

    it('returns 400 when password too short', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'test@example.com', password: 'short' })
        .expect(400);
    });

    it('returns 409 on duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'dup@example.com', password: 'password123' });

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'dup@example.com', password: 'password123' })
        .expect(409);
    });
  });

  describe('POST /auth/login', () => {
    it('returns 200 with JWT after register', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'login@example.com', password: 'password123' });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login@example.com', password: 'password123' })
        .expect(200);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
    });

    it('returns 401 on wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'login2@example.com', password: 'password123' });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login2@example.com', password: 'wrongpass' })
        .expect(401);
    });

    it('returns 401 on unknown email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' })
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('returns 200 with new access_token and refresh_token on valid refresh token', async () => {
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'refresh@example.com', password: 'password123' });

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: reg.body.refresh_token })
        .expect(200);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
      expect(res.body.refresh_token).not.toBe(reg.body.refresh_token);
    });

    it('returns 401 on invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'invalid-token' })
        .expect(401);
    });

    it('returns 401 when refresh_token is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({})
        .expect(401);
    });
  });

  describe('POST /auth/revoke', () => {
    it('returns 200 when authenticated', async () => {
      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'revoke@example.com', password: 'password123' });

      await request(app.getHttpServer())
        .post('/auth/revoke')
        .set('Authorization', `Bearer ${reg.body.access_token}`)
        .expect(200);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .post('/auth/revoke')
        .expect(401);
    });
  });
});
