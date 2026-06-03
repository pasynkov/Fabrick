import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRelated, pageTitleFor } from '../../src/wiki/related.js';

const sym = (file, name, kind = 'class', refs = []) => ({
  id: `${file}::${name}::${kind}`,
  file, name, kind, exported: true, signature: 'x', bodyHash: 'h',
  imports: [], references: refs, location: { row: 1, col: 0 },
});

test('related list outgoing references to other pages', () => {
  const Foo = sym('a.ts', 'Foo', 'class', ['Bar']);
  const Bar = sym('b.ts', 'Bar', 'class');
  const snap = { version: 1, files: {}, symbols: [Foo, Bar] };
  const sourcemap = {
    pages: {
      'entities/Foo.md': { symbols: [Foo.id], files: ['a.ts'] },
      'entities/Bar.md': { symbols: [Bar.id], files: ['b.ts'] },
    },
  };
  const out = computeRelated({ slug: 'entities/Foo.md', sourcemap, snapshot: snap });
  assert.deepEqual(out, ['entities/Bar.md']);
});

test('related dedupes self-references', () => {
  const A = sym('a.ts', 'A', 'class', ['A']);
  const snap = { version: 1, files: {}, symbols: [A] };
  const sourcemap = { pages: { 'entities/A.md': { symbols: [A.id], files: ['a.ts'] } } };
  const out = computeRelated({ slug: 'entities/A.md', sourcemap, snapshot: snap });
  assert.deepEqual(out, []);
});

test('related sorts by reference count descending then by slug', () => {
  const A = sym('a.ts', 'A', 'class', ['B', 'B', 'C']);
  const B = sym('b.ts', 'B', 'class');
  const C = sym('c.ts', 'C', 'class');
  const snap = { version: 1, files: {}, symbols: [A, B, C] };
  const sourcemap = {
    pages: {
      'entities/A.md': { symbols: [A.id], files: ['a.ts'] },
      'entities/B.md': { symbols: [B.id], files: ['b.ts'] },
      'entities/C.md': { symbols: [C.id], files: ['c.ts'] },
    },
  };
  const out = computeRelated({ slug: 'entities/A.md', sourcemap, snapshot: snap });
  assert.deepEqual(out, ['entities/B.md', 'entities/C.md']);
});

test('related caps at maxOut', () => {
  const A = sym('a.ts', 'A', 'class', ['B', 'C', 'D', 'E', 'F']);
  const others = ['B', 'C', 'D', 'E', 'F'].map((n, i) => sym(`${n}.ts`, n, 'class'));
  const snap = { version: 1, files: {}, symbols: [A, ...others] };
  const pages = { 'A.md': { symbols: [A.id], files: ['a.ts'] } };
  for (const o of others) pages[`${o.name}.md`] = { symbols: [o.id], files: [o.file] };
  const sourcemap = { pages };
  const out = computeRelated({ slug: 'A.md', sourcemap, snapshot: snap, maxOut: 3 });
  assert.equal(out.length, 3);
});

test('pageTitleFor returns primary symbol name', () => {
  const Foo = sym('a.ts', 'Foo', 'class');
  const snap = { version: 1, files: {}, symbols: [Foo] };
  const sourcemap = { pages: { 'entities/Foo.md': { symbols: [Foo.id], files: ['a.ts'] } } };
  assert.equal(pageTitleFor('entities/Foo.md', sourcemap, snap), 'Foo');
});
