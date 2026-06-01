import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import * as AdmZip from 'adm-zip';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';
import { QUEUE_SERVICE } from '../src/queue/queue.module';
import { injectSkillVersion } from '../src/skills/skills.controller';

const mockStorage = { putObject: jest.fn(), getObject: jest.fn(), listObjects: jest.fn() };
const mockQueue = { publish: jest.fn(), subscribe: jest.fn() };

describe('Skills Distribution E2E', () => {
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
      'TRUNCATE users, organizations, org_members, projects, repositories CASCADE',
    );
    jest.clearAllMocks();
  });

  async function registerUser(email: string, password = 'password123') {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email, password });
    return { token: res.body.access_token };
  }

  describe('GET /skills/claude', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer())
        .get('/v1/skills/claude')
        .expect(401);
    });

    it('returns a zip with fabrick-* directories named after prompts', async () => {
      const { token } = await registerUser('user@example.com');

      const res = await request(app.getHttpServer())
        .get('/v1/skills/claude')
        .set('Authorization', `Bearer ${token}`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/application\/zip/);

      const zip = new AdmZip(res.body as Buffer);
      const entries = zip.getEntries().map((e) => e.entryName);

      // Should contain fabrick-analyze and fabrick-push directories
      expect(entries.some((e) => e.startsWith('fabrick-analyze/'))).toBe(true);
      expect(entries.some((e) => e.startsWith('fabrick-push/'))).toBe(true);
    });

    it('injects version: 1.<rev> into SKILL.md frontmatter', async () => {
      const { token } = await registerUser('user2@example.com');

      const res = await request(app.getHttpServer())
        .get('/v1/skills/claude')
        .set('Authorization', `Bearer ${token}`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      const zip = new AdmZip(res.body as Buffer);
      const skillEntry = zip.getEntry('fabrick-analyze/SKILL.md');
      expect(skillEntry).toBeDefined();
      const content = skillEntry!.getData().toString('utf-8');
      expect(content).toMatch(/^version: 1\.\d+/m);
    });

    it('returns 404 for unknown tool', async () => {
      const { token } = await registerUser('user3@example.com');

      await request(app.getHttpServer())
        .get('/v1/skills/unknown-tool')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('injectSkillVersion helper', () => {
    it('inserts version: line when no existing version in frontmatter', () => {
      const body = '---\nname: test\n---\nBody content.';
      const result = injectSkillVersion(body, 3);
      expect(result).toMatch(/^---\nname: test\nversion: 1\.3\n---/);
    });

    it('replaces existing version: line', () => {
      const body = '---\nname: test\nversion: 1.1\n---\nBody.';
      const result = injectSkillVersion(body, 5);
      expect(result).toMatch(/version: 1\.5/);
      expect(result).not.toMatch(/version: 1\.1/);
    });

    it('no-op if body does not start with ---', () => {
      const body = 'No frontmatter here.';
      expect(injectSkillVersion(body, 2)).toBe(body);
    });
  });
});
