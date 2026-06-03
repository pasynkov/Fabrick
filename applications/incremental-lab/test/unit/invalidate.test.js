import test from 'node:test';
import assert from 'node:assert/strict';
import { invalidate } from '../../src/invalidate/invalidate.js';

const sym = (file, name, kind, refs = [], extra = {}) => ({
  id: `${file}::${name}::${kind}`,
  file, name, kind, exported: true,
  signature: `${kind} ${name}`, bodyHash: 'h', imports: [], references: refs,
  location: { row: 1, col: 0 }, ...extra,
});

const emptyDiff = () => ({
  files: { added: [], deleted: [], changed: [] },
  symbols: { added: [], deleted: [], sigChanged: [], bodyChanged: [] },
  importsChanged: [],
});

test('no diff → no invalidation', () => {
  const r = invalidate({ diff: emptyDiff(), sourcemap: { pages: {} }, currentSymbols: [] });
  assert.deepEqual(r.pagesInvalidated, []);
  assert.deepEqual(r.pagesDeleted, []);
});

test('body change invalidates only owning page, no cascade', () => {
  const Foo = sym('a.ts', 'Foo', 'class');
  const Bar = sym('b.ts', 'Bar', 'class', ['Foo']);
  const diff = emptyDiff();
  diff.symbols.bodyChanged = [{ before: Foo, after: Foo }];
  const sourcemap = {
    pages: {
      'entities/foo.md': { symbols: [Foo.id], files: ['a.ts'] },
      'entities/bar.md': { symbols: [Bar.id], files: ['b.ts'] },
    },
  };
  const r = invalidate({ diff, sourcemap, currentSymbols: [Foo, Bar] });
  assert.deepEqual(r.pagesInvalidated, ['entities/foo.md']);
});

test('signature change cascades to L2 consumers', () => {
  const A = sym('a.ts', 'A', 'class');
  const B = sym('b.ts', 'B', 'class', ['A']);
  const C = sym('c.ts', 'C', 'class', ['B']);
  const D = sym('d.ts', 'D', 'class', ['C']);
  const diff = emptyDiff();
  diff.symbols.sigChanged = [{ before: A, after: A }];
  const sourcemap = {
    pages: {
      'p/a.md': { symbols: [A.id], files: ['a.ts'] },
      'p/b.md': { symbols: [B.id], files: ['b.ts'] },
      'p/c.md': { symbols: [C.id], files: ['c.ts'] },
      'p/d.md': { symbols: [D.id], files: ['d.ts'] },
    },
  };
  const r = invalidate({ diff, sourcemap, currentSymbols: [A, B, C, D] });
  assert.deepEqual(r.pagesInvalidated, ['p/a.md', 'p/b.md', 'p/c.md']);
});

test('deleted symbol cascades unlimited', () => {
  const A = sym('a.ts', 'A', 'class');
  const B = sym('b.ts', 'B', 'class', ['A']);
  const C = sym('c.ts', 'C', 'class', ['B']);
  const D = sym('d.ts', 'D', 'class', ['C']);
  const diff = emptyDiff();
  diff.symbols.deleted = [A];
  const sourcemap = {
    pages: {
      'p/a.md': { symbols: [A.id], files: ['a.ts'] },
      'p/b.md': { symbols: [B.id], files: ['b.ts'] },
      'p/c.md': { symbols: [C.id], files: ['c.ts'] },
      'p/d.md': { symbols: [D.id], files: ['d.ts'] },
    },
  };
  const r = invalidate({ diff, sourcemap, currentSymbols: [A, B, C, D] });
  // A's page → goes to deleted (only symbol gone). B, C, D invalidated by cascade.
  assert.deepEqual(r.pagesDeleted, ['p/a.md']);
  assert.deepEqual(r.pagesInvalidated, ['p/b.md', 'p/c.md', 'p/d.md']);
});

test('deleted file invalidates pages referencing that file', () => {
  const A = sym('a.ts', 'A', 'class');
  const diff = emptyDiff();
  diff.files.deleted = ['a.ts'];
  const sourcemap = {
    pages: {
      'p/a.md': { symbols: [], files: ['a.ts'] }, // file ref but no symbol ref
    },
  };
  const r = invalidate({ diff, sourcemap, currentSymbols: [] });
  assert.ok(r.pagesInvalidated.includes('p/a.md'));
});

test('new added export invalidates index and surfaces in newSymbols', () => {
  const X = sym('new.ts', 'NewThing', 'class');
  const diff = emptyDiff();
  diff.symbols.added = [X];
  const sourcemap = { pages: { 'index.md': { symbols: [], files: [] } } };
  const r = invalidate({ diff, sourcemap, currentSymbols: [X] });
  assert.ok(r.pagesInvalidated.includes('index.md'));
  assert.equal(r.newSymbols.length, 1);
  assert.equal(r.newSymbols[0].name, 'NewThing');
});

test('page whose all symbols deleted is marked for deletion, not invalidation', () => {
  const A = sym('a.ts', 'A', 'class');
  const diff = emptyDiff();
  diff.symbols.deleted = [A];
  const sourcemap = {
    pages: { 'p/a.md': { symbols: [A.id], files: ['a.ts'] } },
  };
  const r = invalidate({ diff, sourcemap, currentSymbols: [] });
  assert.deepEqual(r.pagesDeleted, ['p/a.md']);
  assert.equal(r.pagesInvalidated.includes('p/a.md'), false);
});

test('reasons attached per page', () => {
  const A = sym('a.ts', 'A', 'class');
  const diff = emptyDiff();
  diff.symbols.bodyChanged = [{ before: A, after: A }];
  const sourcemap = { pages: { 'p/a.md': { symbols: [A.id], files: ['a.ts'] } } };
  const r = invalidate({ diff, sourcemap, currentSymbols: [A] });
  assert.deepEqual(r.reasons['p/a.md'], ['body:A']);
});

test('cascade reasons explain the chain', () => {
  const A = sym('a.ts', 'A', 'class');
  const B = sym('b.ts', 'B', 'class', ['A']);
  const diff = emptyDiff();
  diff.symbols.sigChanged = [{ before: A, after: A }];
  const sourcemap = {
    pages: {
      'p/a.md': { symbols: [A.id], files: ['a.ts'] },
      'p/b.md': { symbols: [B.id], files: ['b.ts'] },
    },
  };
  const r = invalidate({ diff, sourcemap, currentSymbols: [A, B] });
  assert.deepEqual(r.reasons['p/a.md'], ['sig:A']);
  assert.deepEqual(r.reasons['p/b.md'], ['cascade-sig:A→B']);
});
