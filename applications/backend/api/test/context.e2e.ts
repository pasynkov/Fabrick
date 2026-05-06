import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import * as AdmZip from 'adm-zip';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';
import { QUEUE_SERVICE } from '../src/queue/queue.module';

const mockStorage = { putObject: jest.fn(), getObject: jest.fn(), listObjects: jest.fn() };
const mockQueue = { publish: jest.fn(), subscribe: jest.fn() };

function makeZip(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content));
  }
  return zip.toBuffer();
}

describe('Context Upload E2E', () => {
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
      .send({ email: 'ctx@example.com', password: 'password123' });
    const token = regRes.body.access_token;

    const orgRes = await request(app.getHttpServer())
      .post('/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ctx Org' });
    const orgId = orgRes.body.id;

    const projRes = await request(app.getHttpServer())
      .post(`/orgs/${orgId}/projects`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ctx Project' });
    const projectId = projRes.body.id;

    const repoRes = await request(app.getHttpServer())
      .post(`/projects/${projectId}/repos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'ctx-repo', gitRemote: 'https://github.com/test/ctx-repo.git' });
    const repoId = repoRes.body.id;

    return { token, repoId };
  }

  describe('POST /repos/:repoId/context', () => {
    it('uploads zip and calls StorageService.putObject for each file', async () => {
      mockStorage.putObject.mockResolvedValue(undefined);
      const { token, repoId } = await setup();

      const zipBuffer = makeZip({ 'summary.md': '# Summary', 'details/arch.md': '## Arch' });

      await request(app.getHttpServer())
        .post(`/repos/${repoId}/context`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', zipBuffer, { filename: 'context.zip', contentType: 'application/zip' })
        .expect(201);

      expect(mockStorage.putObject).toHaveBeenCalledTimes(2);
      expect(mockStorage.putObject).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('summary.md'),
        expect.any(Buffer),
      );
      expect(mockStorage.putObject).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('details/arch.md'),
        expect.any(Buffer),
      );
    });

    it('returns 400 when file field is missing', async () => {
      const { token, repoId } = await setup();

      await request(app.getHttpServer())
        .post(`/repos/${repoId}/context`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/repos/repoid/context')
        .expect(401);
    });
  });

  describe('POST /repos/:repoId/context — backend-driven synthesis triggering', () => {
    async function setupWithApiKeyAndRepo() {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'synthctx@example.com', password: 'password123' });
      const token = regRes.body.access_token;

      const orgRes = await request(app.getHttpServer())
        .post('/orgs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Synth Ctx Org' });
      const orgId = orgRes.body.id;

      await request(app.getHttpServer())
        .patch(`/orgs/${orgId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ anthropicApiKey: 'sk-ant-test-key-for-e2e-testing' });

      const projRes = await request(app.getHttpServer())
        .post(`/orgs/${orgId}/projects`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Synth Ctx Project' });
      const projectId = projRes.body.id;

      const repoRes = await request(app.getHttpServer())
        .post(`/projects/${projectId}/repos`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'ctx-repo-synth', gitRemote: 'https://github.com/test/ctx-repo-synth.git' });
      const repoId = repoRes.body.id;

      return { token, orgId, projectId, repoId };
    }

    it('triggers synthesis automatically when autoSynthesisEnabled is true', async () => {
      mockStorage.putObject.mockResolvedValue(undefined);
      mockQueue.publish.mockResolvedValue(undefined);
      const { token, orgId, projectId, repoId } = await setupWithApiKeyAndRepo();

      await request(app.getHttpServer())
        .patch(`/orgs/${orgId}/projects/${projectId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ autoSynthesisEnabled: true });

      const zipBuffer = makeZip({ 'summary.md': '# Summary' });
      await request(app.getHttpServer())
        .post(`/repos/${repoId}/context`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', zipBuffer, { filename: 'context.zip', contentType: 'application/zip' })
        .expect(201);

      expect(mockQueue.publish).toHaveBeenCalledWith('synthesis-jobs', expect.objectContaining({ projectId }));
    });

    it('triggers synthesis when triggerSynthesis=true and autoSynthesisEnabled is false', async () => {
      mockStorage.putObject.mockResolvedValue(undefined);
      mockQueue.publish.mockResolvedValue(undefined);
      const { token, repoId, projectId } = await setupWithApiKeyAndRepo();

      const zipBuffer = makeZip({ 'summary.md': '# Summary' });
      await request(app.getHttpServer())
        .post(`/repos/${repoId}/context`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', zipBuffer, { filename: 'context.zip', contentType: 'application/zip' })
        .field('triggerSynthesis', 'true')
        .expect(201);

      expect(mockQueue.publish).toHaveBeenCalledWith('synthesis-jobs', expect.objectContaining({ projectId }));
    });

    it('does not trigger synthesis when autoSynthesisEnabled is false and no triggerSynthesis flag', async () => {
      mockStorage.putObject.mockResolvedValue(undefined);
      mockQueue.publish.mockResolvedValue(undefined);
      const { token, repoId } = await setupWithApiKeyAndRepo();

      const zipBuffer = makeZip({ 'summary.md': '# Summary' });
      await request(app.getHttpServer())
        .post(`/repos/${repoId}/context`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', zipBuffer, { filename: 'context.zip', contentType: 'application/zip' })
        .expect(201);

      expect(mockQueue.publish).not.toHaveBeenCalled();
    });

    it('upload returns 201 even if synthesis trigger would fail', async () => {
      mockStorage.putObject.mockResolvedValue(undefined);
      mockQueue.publish.mockRejectedValue(new Error('queue unavailable'));
      const { token, orgId, projectId, repoId } = await setupWithApiKeyAndRepo();

      await request(app.getHttpServer())
        .patch(`/orgs/${orgId}/projects/${projectId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ autoSynthesisEnabled: true });

      const zipBuffer = makeZip({ 'summary.md': '# Summary' });
      await request(app.getHttpServer())
        .post(`/repos/${repoId}/context`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', zipBuffer, { filename: 'context.zip', contentType: 'application/zip' })
        .expect(201);
    });
  });
});
