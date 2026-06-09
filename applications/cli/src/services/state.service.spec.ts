import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs';
import { StateService } from './state.service';

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

describe('StateService', () => {
  let service: StateService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StateService('/test-cwd');
  });

  describe('load()', () => {
    it('returns defaults when state.json is missing', () => {
      mockExistsSync.mockReturnValue(false);
      const state = service.load();
      expect(state.baselineSha).toBeNull();
      expect(state.scopes).toEqual([]);
      expect(state.lastSyncedAt).toBeNull();
      expect(state.lastDossierUpdatedId).toBeNull();
    });

    it('returns parsed state when file exists', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        baselineSha: 'abc123',
        scopes: [{ name: 'api', root: 'apps/api', kind: 'app' }],
        lastSyncedAt: '2025-01-01T00:00:00.000Z',
        lastDossierUpdatedId: 'du-1',
      }));
      const state = service.load();
      expect(state.baselineSha).toBe('abc123');
      expect(state.scopes).toHaveLength(1);
      expect(state.lastDossierUpdatedId).toBe('du-1');
    });

    it('returns defaults on corrupt JSON', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('not-json');
      const state = service.load();
      expect(state.baselineSha).toBeNull();
    });
  });

  describe('save()', () => {
    it('writes via temp + rename atomically', () => {
      const state = { baselineSha: 'sha1', scopes: [], lastSyncedAt: null, lastDossierUpdatedId: null };
      service.save(state);
      expect(writeFileSync).toHaveBeenCalledWith(expect.stringContaining('.tmp'), expect.any(String), 'utf8');
      expect(renameSync).toHaveBeenCalled();
    });
  });
});
