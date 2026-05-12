import { diffHashmaps } from './hash-scanner';

describe('diffHashmaps', () => {
  it('returns all files as added when previous hashmap is empty', () => {
    const newMap = { 'src/a.ts': 'hash1', 'src/b.ts': 'hash2' };
    const result = diffHashmaps(newMap, {});
    expect(result.added).toEqual(expect.arrayContaining(['src/a.ts', 'src/b.ts']));
    expect(result.changed).toHaveLength(0);
    expect(result.deleted).toHaveLength(0);
  });

  it('detects changed files when hash differs', () => {
    const prev = { 'src/a.ts': 'oldhash', 'src/b.ts': 'hash2' };
    const next = { 'src/a.ts': 'newhash', 'src/b.ts': 'hash2' };
    const result = diffHashmaps(next, prev);
    expect(result.changed).toEqual(['src/a.ts']);
    expect(result.added).toHaveLength(0);
    expect(result.deleted).toHaveLength(0);
  });

  it('detects added files', () => {
    const prev = { 'src/a.ts': 'hash1' };
    const next = { 'src/a.ts': 'hash1', 'src/b.ts': 'hash2' };
    const result = diffHashmaps(next, prev);
    expect(result.added).toEqual(['src/b.ts']);
    expect(result.changed).toHaveLength(0);
    expect(result.deleted).toHaveLength(0);
  });

  it('detects deleted files', () => {
    const prev = { 'src/a.ts': 'hash1', 'src/b.ts': 'hash2' };
    const next = { 'src/a.ts': 'hash1' };
    const result = diffHashmaps(next, prev);
    expect(result.deleted).toEqual(['src/b.ts']);
    expect(result.changed).toHaveLength(0);
    expect(result.added).toHaveLength(0);
  });

  it('handles combined changes, additions, and deletions', () => {
    const prev = { 'src/a.ts': 'hash1', 'src/b.ts': 'hash2', 'src/c.ts': 'hash3' };
    const next = { 'src/a.ts': 'newhash', 'src/d.ts': 'hash4' };
    const result = diffHashmaps(next, prev);
    expect(result.changed).toEqual(['src/a.ts']);
    expect(result.added).toEqual(['src/d.ts']);
    expect(result.deleted).toEqual(expect.arrayContaining(['src/b.ts', 'src/c.ts']));
  });
});
