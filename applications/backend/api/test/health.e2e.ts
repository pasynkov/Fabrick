import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';
import { QUEUE_SERVICE } from '../src/queue/queue.module';

const mockStorage = { putObject: jest.fn(), getObject: jest.fn(), listObjects: jest.fn() };
const mockQueue = { publish: jest.fn(), subscribe: jest.fn() };

describe('Health E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DB_NAME = process.env.DB_TEST_NAME || 'fabrick_test';

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(StorageService).useValue(mockStorage)
      .overrideProvider(QUEUE_SERVICE).useValue(mockQueue)
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns status ok and app-version', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body['version']).toBe('string');
    expect(res.body['version']).toMatch(/^\d+\.\d+\.\d+/);
  });
});
