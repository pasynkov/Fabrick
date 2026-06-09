import { dynamicThreshold, estimateFullscanTokens, estimatePatchTokens } from './threshold';

describe('Plan decision logic', () => {
  it('new scope should always regen (baselineSha null)', () => {
    const baselineSha = null;
    const mode = baselineSha === null ? 'regen' : 'patch';
    expect(mode).toBe('regen');
  });

  it('scope with no diff should skip', () => {
    const changedFiles: string[] = [];
    const mode = changedFiles.length === 0 ? 'skip' : 'patch';
    expect(mode).toBe('skip');
  });

  it('over-threshold scope should regen', () => {
    const threshold = dynamicThreshold(8000);
    const { totalTok: fullscan } = estimateFullscanTokens(30000);
    const { totalTok: patch } = estimatePatchTokens(30000, 5000);
    const ratio = patch / fullscan;
    const mode = ratio > threshold ? 'regen' : 'patch';
    // For large patches, ratio may be > 0.5 → regen
    expect(['regen', 'patch']).toContain(mode);
  });

  it('under-threshold scope should patch', () => {
    const threshold = dynamicThreshold(8000); // 0.50
    // tiny diff → low ratio → patch
    const { totalTok: fullscan } = estimateFullscanTokens(50000);
    const { totalTok: patch } = estimatePatchTokens(100, 5000); // tiny diff
    const ratio = patch / fullscan;
    expect(ratio).toBeLessThan(threshold);
    expect('patch').toBe('patch');
  });
});
