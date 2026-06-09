import { dynamicThreshold } from './threshold';

describe('dynamicThreshold', () => {
  it('returns ~0.30 for 1k tokens', () => {
    expect(dynamicThreshold(1000)).toBeCloseTo(0.30, 1);
  });

  it('returns ~0.50 for 8k tokens', () => {
    expect(dynamicThreshold(8000)).toBeCloseTo(0.50, 1);
  });

  it('returns ~0.70 for 50k tokens', () => {
    expect(dynamicThreshold(50000)).toBeGreaterThan(0.65);
    expect(dynamicThreshold(50000)).toBeLessThan(0.80);
  });

  it('returns ~0.90 for 500k tokens', () => {
    expect(dynamicThreshold(500000)).toBeCloseTo(0.90, 1);
  });

  it('clamps at 0.30 for very small inputs', () => {
    expect(dynamicThreshold(1)).toBe(0.30);
  });

  it('clamps at 0.90 for very large inputs', () => {
    expect(dynamicThreshold(10_000_000)).toBe(0.90);
  });
});
