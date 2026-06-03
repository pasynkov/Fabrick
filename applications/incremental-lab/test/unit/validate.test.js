import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, structuralEquivalence } from '../../src/validate/validate.js';

const sym = (file, name, kind = 'class') => ({
  id: `${file}::${name}::${kind}`,
  file, name, kind, exported: true, signature: 'x', bodyHash: 'h',
  imports: [], references: [], location: { row: 1, col: 0 },
});

test('clean wiki has no violations', () => {
  const A = sym('a.ts', 'A');
  const snap = { version: 1, files: { 'a.ts': { hash: 'h' } }, symbols: [A] };
  const smap = { pages: { 'p/a.md': { symbols: [A.id], files: ['a.ts'] } } };
  const r = validate({ snapshot: snap, sourcemap: smap });
  assert.equal(r.ok, true);
  assert.deepEqual(r.violations, []);
});

test('I1 violation: page cites missing symbol', () => {
  const snap = { version: 1, files: {}, symbols: [] };
  const smap = { pages: { 'p/x.md': { symbols: ['ghost::X::class'], files: [] } } };
  const r = validate({ snapshot: snap, sourcemap: smap });
  const v = r.violations.find((x) => x.invariant === 'I1');
  assert.ok(v);
  assert.equal(v.symbol, 'ghost::X::class');
});

test('I2 violation: page cites missing file', () => {
  const snap = { version: 1, files: {}, symbols: [] };
  const smap = { pages: { 'p/x.md': { symbols: [], files: ['gone.ts'] } } };
  const r = validate({ snapshot: snap, sourcemap: smap });
  const v = r.violations.find((x) => x.invariant === 'I2');
  assert.ok(v);
  assert.equal(v.file, 'gone.ts');
});

test('I5 violation: orphan page (all symbols missing)', () => {
  const snap = { version: 1, files: { 'a.ts': { hash: 'h' } }, symbols: [] };
  const smap = { pages: { 'p/a.md': { symbols: ['a.ts::Gone::class'], files: ['a.ts'] } } };
  const r = validate({ snapshot: snap, sourcemap: smap });
  const v = r.violations.find((x) => x.invariant === 'I5');
  assert.ok(v);
});

test('structuralEquivalence identical = drift 0', () => {
  const m = { pages: { 'a.md': { symbols: ['x'], files: ['a.ts'] } } };
  const r = structuralEquivalence(m, m);
  assert.equal(r.drift, 0);
});

test('structuralEquivalence reports page differences', () => {
  const A = { pages: {
    'a.md': { symbols: ['x'], files: ['a.ts'] },
    'b.md': { symbols: ['y'], files: ['b.ts'] },
  }};
  const B = { pages: {
    'a.md': { symbols: ['x', 'extra'], files: ['a.ts'] },
    'c.md': { symbols: ['z'], files: ['c.ts'] },
  }};
  const r = structuralEquivalence(A, B);
  assert.deepEqual(r.onlyInA, ['b.md']);
  assert.deepEqual(r.onlyInB, ['c.md']);
  assert.deepEqual(r.symbolsDiffer, ['a.md']);
  assert.ok(r.drift > 0);
});
