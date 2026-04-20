import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { stringify } from 'yaml';
import { CredentialsService } from './credentials.service';

jest.mock('fs');
jest.mock('os', () => ({ homedir: () => '/home/user' }));

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
const mockChmodSync = chmodSync as jest.MockedFunction<typeof chmodSync>;
const mockMkdirSync = mkdirSync as jest.MockedFunction<typeof mkdirSync>;

describe('CredentialsService', () => {
  let service: CredentialsService;
  const cwd = process.cwd();
  const localPath = join(cwd, '.fabrick', 'credentials.yaml');
  const globalPath = '/home/user/.fabrick/credentials.yaml';
  const creds = { token: 'tok123', api_url: 'http://localhost:3000' };

  beforeEach(() => {
    service = new CredentialsService();
    jest.clearAllMocks();
  });

  describe('read()', () => {
    it('reads from local path when it exists', () => {
      mockExistsSync.mockImplementation((p) => p === localPath);
      mockReadFileSync.mockReturnValue(stringify(creds) as any);

      const result = service.read();

      expect(result).toEqual(creds);
      expect(mockReadFileSync).toHaveBeenCalledWith(localPath, 'utf8');
    });

    it('falls back to global path when local absent', () => {
      mockExistsSync.mockImplementation((p) => p === globalPath);
      mockReadFileSync.mockReturnValue(stringify(creds) as any);

      const result = service.read();

      expect(result).toEqual(creds);
      expect(mockReadFileSync).toHaveBeenCalledWith(globalPath, 'utf8');
    });

    it('returns null when neither path exists', () => {
      mockExistsSync.mockReturnValue(false);

      expect(service.read()).toBeNull();
    });

    it('returns null on parse error', () => {
      mockExistsSync.mockImplementation((p) => p === localPath);
      mockReadFileSync.mockImplementation(() => { throw new Error('read error'); });

      expect(service.read()).toBeNull();
    });
  });

  describe('write()', () => {
    it('writes to local path', () => {
      service.write(creds);

      expect(mockMkdirSync).toHaveBeenCalledWith(
        join(cwd, '.fabrick'),
        { recursive: true },
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        localPath,
        stringify(creds),
        { encoding: 'utf8' },
      );
      expect(mockChmodSync).toHaveBeenCalledWith(localPath, 0o600);
    });

    it('never writes to global path', () => {
      service.write(creds);

      const writtenPaths = mockWriteFileSync.mock.calls.map((c) => c[0]);
      expect(writtenPaths).not.toContain(globalPath);
    });
  });

  describe('requireAuth()', () => {
    it('returns credentials when present', () => {
      mockExistsSync.mockImplementation((p) => p === localPath);
      mockReadFileSync.mockReturnValue(stringify(creds) as any);

      expect(service.requireAuth()).toEqual(creds);
    });

    it('calls process.exit(1) when no credentials', () => {
      mockExistsSync.mockReturnValue(false);
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

      expect(() => service.requireAuth()).toThrow('exit');
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
    });
  });
});
