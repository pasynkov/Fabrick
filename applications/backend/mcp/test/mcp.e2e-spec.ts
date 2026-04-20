import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import * as Minio from 'minio';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { CliToken } from '../src/auth/cli-token.entity';
import { McpModule } from '../src/mcp/mcp.module';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || 'fabrick';
const DB_USER = process.env.DB_USER || 'fabrick';
const DB_PASS = process.env.DB_PASS || 'fabrick';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10);

const ORG_SLUG = 'test-org-mcp';
const PROJECT_SLUG = 'test-project-mcp';
const INDEX_CONTENT = '# Test Index\n\n- apps/backend.md — backend app\n- cross-cutting/envs.md — all env vars';
const ENVS_CONTENT = '# Env Vars\n\n| Name | Description |\n|------|-------------|\n| DB_HOST | Database host |';

async function seedMinIO(): Promise<void> {
  const client = new Minio.Client({
    endPoint: MINIO_ENDPOINT,
    port: MINIO_PORT,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  });

  const exists = await client.bucketExists(ORG_SLUG);
  if (!exists) await client.makeBucket(ORG_SLUG);

  await client.putObject(ORG_SLUG, `${PROJECT_SLUG}/synthesis/index.md`, Buffer.from(INDEX_CONTENT));
  await client.putObject(ORG_SLUG, `${PROJECT_SLUG}/synthesis/cross-cutting/envs.md`, Buffer.from(ENVS_CONTENT));
}

async function cleanMinIO(): Promise<void> {
  const client = new Minio.Client({
    endPoint: MINIO_ENDPOINT,
    port: MINIO_PORT,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  });
  try {
    const keys: string[] = await new Promise((resolve, reject) => {
      const list: string[] = [];
      const stream = client.listObjects(ORG_SLUG, `${PROJECT_SLUG}/synthesis/`, true);
      stream.on('data', (obj) => { if (obj.name) list.push(obj.name); });
      stream.on('end', () => resolve(list));
      stream.on('error', reject);
    });
    for (const key of keys) await client.removeObject(ORG_SLUG, key);
  } catch { /* ignore */ }
}

describe('MCP E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let validToken: string;
  let tokenId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: DB_HOST,
          port: DB_PORT,
          database: DB_NAME,
          username: DB_USER,
          password: DB_PASS,
          entities: [CliToken],
          synchronize: false,
        }),
        McpModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    await app.init();
    await app.listen(0); // random available port

    dataSource = moduleRef.get(DataSource);

    // Seed: create user + CLI token (raw SQL to avoid registering User entity)
    const userId = randomUUID();
    await dataSource.query(
      `INSERT INTO users (id, email, "passwordHash") VALUES ($1, $2, $3)`,
      [userId, 'test-mcp@fabrick.test', 'hash'],
    );
    validToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(validToken).digest('hex');
    const repo = dataSource.getRepository(CliToken);
    const record = repo.create({ tokenHash, userId });
    const saved = await repo.save(record);
    tokenId = saved.id;

    // Seed MinIO with synthesis files
    await seedMinIO();
  });

  afterAll(async () => {
    // Cleanup token + user
    if (dataSource && tokenId) {
      const token = await dataSource.getRepository(CliToken).findOne({ where: { id: tokenId } });
      if (token) {
        await dataSource.getRepository(CliToken).delete({ id: tokenId });
        await dataSource.query(`DELETE FROM users WHERE id = $1`, [token.userId]);
      }
    }
    await cleanMinIO();
    await app.close();
  });

  it('7.2 — invalid token → 401', async () => {
    await request(app.getHttpServer())
      .post('/mcp')
      .set('Authorization', 'Bearer invalid-token-xyz')
      .set('X-Fabrick-Org', ORG_SLUG)
      .set('X-Fabrick-Project', PROJECT_SLUG)
      .send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } } })
      .expect(401);
  });

  it('7.3 — valid token, no synthesis → get_synthesis_index returns "not available"', async () => {
    // Use a project slug with no synthesis files
    const noSynthProject = 'no-synthesis-project-mcp';

    const serverUrl = `http://localhost:${(app.getHttpServer() as any).address().port}/mcp`;
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${validToken}`,
          'X-Fabrick-Org': ORG_SLUG,
          'X-Fabrick-Project': noSynthProject,
        },
      },
    });
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(transport);

    const result = await client.callTool({ name: 'get_synthesis_index', arguments: {} });
    const text = (result.content as any[])[0]?.text as string;
    expect(text).toContain('not available');

    await client.close();
  });

  it('7.4 — valid token, synthesis exists → get_synthesis_index returns index.md', async () => {
    const serverUrl = `http://localhost:${(app.getHttpServer() as any).address().port}/mcp`;
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${validToken}`,
          'X-Fabrick-Org': ORG_SLUG,
          'X-Fabrick-Project': PROJECT_SLUG,
        },
      },
    });
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(transport);

    const result = await client.callTool({ name: 'get_synthesis_index', arguments: {} });
    const text = (result.content as any[])[0]?.text as string;
    expect(text).toBe(INDEX_CONTENT);

    await client.close();
  });

  it('7.5 — valid token → get_synthesis_file("cross-cutting/envs.md") returns file content', async () => {
    const serverUrl = `http://localhost:${(app.getHttpServer() as any).address().port}/mcp`;
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${validToken}`,
          'X-Fabrick-Org': ORG_SLUG,
          'X-Fabrick-Project': PROJECT_SLUG,
        },
      },
    });
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(transport);

    const result = await client.callTool({ name: 'get_synthesis_file', arguments: { path: 'cross-cutting/envs.md' } });
    const text = (result.content as any[])[0]?.text as string;
    expect(text).toBe(ENVS_CONTENT);

    await client.close();
  });

  it('7.6 — valid token → get_synthesis_file("does-not-exist.md") returns "not found"', async () => {
    const serverUrl = `http://localhost:${(app.getHttpServer() as any).address().port}/mcp`;
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${validToken}`,
          'X-Fabrick-Org': ORG_SLUG,
          'X-Fabrick-Project': PROJECT_SLUG,
        },
      },
    });
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(transport);

    const result = await client.callTool({ name: 'get_synthesis_file', arguments: { path: 'does-not-exist.md' } });
    const text = (result.content as any[])[0]?.text as string;
    expect(text).toContain('not found');

    await client.close();
  });
});
