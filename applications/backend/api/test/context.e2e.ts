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
});
