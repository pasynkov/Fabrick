import test from 'node:test';
import assert from 'node:assert/strict';
import { synthSourcemap, applyInvalidation } from '../../src/bench/synth-sourcemap.js';

const sym = (file, name, kind = 'class', exported = true) => ({
  id: `${file}::${name}::${kind}`,
  file, name, kind, exported, signature: 'x', bodyHash: 'h',
  imports: [], references: [], location: { row: 1, col: 0 },
});

test('synth produces one page per exported top-level symbol', () => {
  const snap = { version: 1, files: {}, symbols: [
    sym('a.ts', 'A', 'class'),
    sym('b.ts', 'B', 'function'),
    sym('c.ts', 'C.method', 'method'),  // not top-level
  ]};
  const m = synthSourcemap(snap);
  assert.ok(m.pages['entities/A.md']);
  assert.ok(m.pages['logic/B.md']);
  assert.ok(!m.pages['logic/C.method.md']);
  assert.ok(m.pages['index.md']);
});

test('applyInvalidation drops deleted pages', () => {
  const m = { pages: { 'a.md': { symbols: ['x'], files: ['a.ts'] }, 'b.md': { symbols: ['y'], files: ['b.ts'] } } };
  const next = applyInvalidation({ sourcemap: m, invalidation: { pagesDeleted: ['a.md'], pagesInvalidated: [], newSymbols: [] }, newSnapshot: { symbols: [] } });
  assert.equal(Object.keys(next.pages).length, 1);
  assert.ok(next.pages['b.md']);
});

test('applyInvalidation adds pages for new symbols', () => {
  const X = sym('new.ts', 'NewThing', 'class');
  const next = applyInvalidation({
    sourcemap: { pages: { 'index.md': { symbols: [], files: [] } } },
    invalidation: { pagesDeleted: [], pagesInvalidated: [], newSymbols: [X] },
    newSnapshot: { symbols: [X] },
  });
  assert.ok(next.pages['entities/NewThing.md']);
});
