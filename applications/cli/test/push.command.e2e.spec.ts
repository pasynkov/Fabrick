// E2E-style test for PushCommand: mocks FS + fetch, runs the full upload flow

import * as fs from 'fs';

jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
  };
});

// archiver is used inside PushCommand.zipContext() — we mock the full module
jest.mock('archiver', () => {
  const mockArchive = {
    pipe: jest.fn(),
    directory: jest.fn(),
    finalize: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  };

  const factory = jest.fn().mockReturnValue(mockArchive);
  (factory as any).default = factory;
  return factory;
});

import { PushCommand } from '../src/push.command';
import { CredentialsService } from '../src/credentials.service';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('PushCommand e2e — upload flow', () => {
  let command: PushCommand;
  let credsService: jest.Mocked<CredentialsService>;

  const mockCreds = { token: 'fbrk_mytoken', api_url: 'http://localhost:3000' };
  const mockConfig = { repo_id: 'repo123', api_url: 'http://localhost:3000' };

  beforeEach(() => {
    credsService = {
      requireAuth: jest.fn().mockReturnValue(mockCreds),
      read: jest.fn(),
      write: jest.fn(),
    } as any;

    command = new PushCommand(credsService);

    (fs.existsSync as jest.Mock).mockImplementation((p: string) => {
      if (String(p).endsWith('config.yaml')) return true;
      if (String(p).endsWith('context')) return true;
      return false;
    });

    (fs.readFileSync as jest.Mock).mockReturnValue(
      `repo_id: ${mockConfig.repo_id}\napi_url: ${mockConfig.api_url}\n`,
    );

    mockFetch.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uploads with correct endpoint and Authorization header', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    jest.spyOn(command as any, 'zipContext').mockResolvedValue(Buffer.from('zip-data'));

    await command.run();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/repos/repo123/context',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer fbrk_mytoken' }),
      }),
    );
  });

  it('calls correct endpoint with repo_id from config', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    jest.spyOn(command as any, 'zipContext').mockResolvedValue(Buffer.from('zip'));
    jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await command.run();

    const [url] = mockFetch.mock.calls[0] as [string, any];
    expect(url).toBe('http://localhost:3000/repos/repo123/context');
  });

  it('exits 1 when config.yaml missing', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    jest.spyOn(process, 'exit').mockImplementation(((code: number) => { throw new Error('EXIT_' + code); }) as any);

    await expect(command.run()).rejects.toThrow('EXIT_1');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('exits 1 when upload returns non-ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' });
    jest.spyOn(command as any, 'zipContext').mockResolvedValue(Buffer.from('zip'));
    jest.spyOn(process, 'exit').mockImplementation(((code: number) => { throw new Error('EXIT_' + code); }) as any);

    await expect(command.run()).rejects.toThrow('EXIT_1');
  });
});
