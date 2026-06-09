import { existsSync, readFileSync, renameSync, writeFileSync, mkdirSync } from 'fs';
import { ConfigService, coerceConfigValue } from './config.service';

jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    renameSync: jest.fn(),
    mkdirSync: jest.fn(),
  };
});

const mockExistsSync = existsSync as jest.Mock;
const mockReadFileSync = readFileSync as jest.Mock;

const VALID_CONFIG = {
  version: 2,
  orgSlug: 'acme',
  projectId: 'proj-1',
  projectSlug: 'platform',
  repoId: 'repo-1',
  repoName: 'monorepo',
  gitRemote: 'https://github.com/acme/mono.git',
  agent: 'claude',
  apiUrl: 'https://api.fabrick.me/',
  scan: { ignore: [], rebuildThreshold: {} },
};

describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConfigService('/test-cwd');
  });

  describe('load()', () => {
    it('returns parsed config when valid JSON exists', () => {
      mockExistsSync.mockImplementation((p: string) => String(p).endsWith('config.json'));
      mockReadFileSync.mockReturnValue(JSON.stringify(VALID_CONFIG));
      const config = service.load();
      expect(config.orgSlug).toBe('acme');
      expect(config.agent).toBe('claude');
    });

    it('hard-errors when YAML exists without JSON', () => {
      mockExistsSync.mockImplementation((p: string) => {
        if (String(p).endsWith('config.yaml')) return true;
        if (String(p).endsWith('config.json')) return false;
        return false;
      });
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((n: number) => { throw new Error('EXIT_' + n); }) as any);
      expect(() => service.load()).toThrow('EXIT_1');
      exitSpy.mockRestore();
    });

    it('hard-errors when config.json fails schema validation', () => {
      mockExistsSync.mockImplementation((p: string) => String(p).endsWith('config.json'));
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: 2 })); // missing required fields
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((n: number) => { throw new Error('EXIT_' + n); }) as any);
      expect(() => service.load()).toThrow('EXIT_1');
      exitSpy.mockRestore();
    });

    it('hard-errors when agent is invalid', () => {
      mockExistsSync.mockImplementation((p: string) => String(p).endsWith('config.json'));
      mockReadFileSync.mockReturnValue(JSON.stringify({ ...VALID_CONFIG, agent: 'invalid' }));
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((n: number) => { throw new Error('EXIT_' + n); }) as any);
      expect(() => service.load()).toThrow('EXIT_1');
      exitSpy.mockRestore();
    });
  });

  describe('save()', () => {
    it('writes via temp + rename', () => {
      service.save(VALID_CONFIG as any);
      expect(writeFileSync).toHaveBeenCalledWith(expect.stringContaining('.tmp'), expect.any(String), 'utf8');
      expect(renameSync).toHaveBeenCalled();
    });
  });
});

describe('coerceConfigValue', () => {
  it('coerces true/false strings to booleans', () => {
    expect(coerceConfigValue('true')).toBe(true);
    expect(coerceConfigValue('false')).toBe(false);
  });

  it('coerces numeric strings to numbers', () => {
    expect(coerceConfigValue('42')).toBe(42);
    expect(coerceConfigValue('3.14')).toBeCloseTo(3.14);
  });

  it('coerces JSON arrays', () => {
    expect(coerceConfigValue('["a","b"]')).toEqual(['a', 'b']);
  });

  it('returns string as-is when not coercible', () => {
    expect(coerceConfigValue('hello')).toBe('hello');
  });
});
