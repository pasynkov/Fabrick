import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';
import { QUEUE_SERVICE } from '../src/queue/queue.module';

const mockStorage = { putObject: jest.fn(), getObject: jest.fn(), listObjects: jest.fn() };
const mockQueue = { publish: jest.fn(), subscribe: jest.fn() };

describe('Repos E2E', () => {
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
    jest.clearAllMocks();
  });

  async function setup() {
    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'repos@example.com', password: 'password123' });
    const token = regRes.body.access_token;

    const orgRes = await request(app.getHttpServer())
      .post('/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Org' });
    const orgId = orgRes.body.id;

    const projRes = await request(app.getHttpServer())
      .post(`/orgs/${orgId}/projects`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Project' });
    const projectId = projRes.body.id;

    return { token, orgId, projectId };
  }

  describe('POST /orgs/:orgId/projects', () => {
    it('creates project', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'proj@example.com', password: 'password123' });
      const token = regRes.body.access_token;

      const orgRes = await request(app.getHttpServer())
        .post('/orgs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Proj Org' });

      const res = await request(app.getHttpServer())
        .post(`/orgs/${orgRes.body.id}/projects`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My Project' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('My Project');
    });
  });

  describe('POST /projects/:projectId/repos', () => {
    it('creates repo under project', async () => {
      const { token, projectId } = await setup();

      const res = await request(app.getHttpServer())
        .post(`/projects/${projectId}/repos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'myrepo', gitRemote: 'https://github.com/test/myrepo.git' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.gitRemote).toBe('github.com/test/myrepo');
    });

    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/projects/proj1/repos')
        .send({ name: 'myrepo', gitRemote: 'https://github.com/test/myrepo.git' })
        .expect(401);
    });
  });

  describe('POST /repos/find-or-create', () => {
    it('creates repo on first call, finds on second', async () => {
      const { token, projectId } = await setup();
      const gitRemote = 'https://github.com/test/findorcreate.git';

      const res1 = await request(app.getHttpServer())
        .post('/repos/find-or-create')
        .set('Authorization', `Bearer ${token}`)
        .send({ gitRemote, projectId });

      const res2 = await request(app.getHttpServer())
        .post('/repos/find-or-create')
        .set('Authorization', `Bearer ${token}`)
        .send({ gitRemote, projectId });

      expect(res1.body.id).toBe(res2.body.id);
    });
  });
});
