import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';
import { QUEUE_SERVICE } from '../src/queue/queue.module';

const mockStorage = { putObject: jest.fn(), getObject: jest.fn(), listObjects: jest.fn() };
const mockQueue = { publish: jest.fn(), subscribe: jest.fn() };

describe('Synthesis E2E', () => {
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
      .send({ email: 'synth@example.com', password: 'password123' });
    const token = regRes.body.access_token;

    const orgRes = await request(app.getHttpServer())
      .post('/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Synth Org' });
    const orgId = orgRes.body.id;

    const projRes = await request(app.getHttpServer())
      .post(`/orgs/${orgId}/projects`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Synth Project' });
    const projectId = projRes.body.id;

    return { token, orgId, projectId };
  }

  describe('POST /projects/:id/synthesis', () => {
    it('triggers synthesis, returns 202, publishes to queue', async () => {
      mockQueue.publish.mockResolvedValue(undefined);
      const { token, projectId } = await setup();

      await request(app.getHttpServer())
        .post(`/projects/${projectId}/synthesis`)
        .set('Authorization', `Bearer ${token}`)
        .expect(202);

      expect(mockQueue.publish).toHaveBeenCalledWith(
        'synthesis-jobs',
        expect.objectContaining({ projectId }),
      );
    });

    it('returns 409 if synthesis already running', async () => {
      mockQueue.publish.mockResolvedValue(undefined);
      const { token, projectId } = await setup();

      await request(app.getHttpServer())
        .post(`/projects/${projectId}/synthesis`)
        .set('Authorization', `Bearer ${token}`)
        .expect(202);

      await request(app.getHttpServer())
        .post(`/projects/${projectId}/synthesis`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
    });

    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/projects/proj1/synthesis')
        .expect(401);
    });
  });

  describe('GET /projects/:id/synthesis/status', () => {
    it('returns status after trigger', async () => {
      mockQueue.publish.mockResolvedValue(undefined);
      const { token, projectId } = await setup();

      await request(app.getHttpServer())
        .post(`/projects/${projectId}/synthesis`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(app.getHttpServer())
        .get(`/projects/${projectId}/synthesis/status`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe('running');
    });
  });
});
