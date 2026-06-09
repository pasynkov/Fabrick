import { appendFileSync, mkdirSync } from 'fs';
import { PatchLogService, PatchLogEntry } from './patch-log.service';

jest.mock('fs', () => ({ ...jest.requireActual('fs'), appendFileSync: jest.fn(), mkdirSync: jest.fn() }));

const mockAppendFileSync = appendFileSync as jest.Mock;

describe('PatchLogService', () => {
  let service: PatchLogService;

  beforeEach(() => { jest.clearAllMocks(); service = new PatchLogService(); });

  it('appends a JSON line with required fields', () => {
    const entry: PatchLogEntry = {
      at: '2025-01-01T00:00:00.000Z',
      title: 'test',
      baselineSha: 'abc',
      headSha: 'def',
      costUsd: 0.01,
      scopes: [{ name: 'apps/api', mode: 'patch', slugCounts: {}, sample: [], description: 'test change' }],
    };
    service.append('/repo', entry);
    expect(mockAppendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('patches.log.jsonl'),
      expect.stringContaining('"headSha":"def"'),
    );
    const written = mockAppendFileSync.mock.calls[0][1] as string;
    const parsed = JSON.parse(written.trim());
    expect(parsed.at).toBe(entry.at);
    expect(parsed.headSha).toBe('def');
    expect(parsed.scopes).toHaveLength(1);
  });
});
