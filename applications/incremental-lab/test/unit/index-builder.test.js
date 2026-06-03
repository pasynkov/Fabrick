import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex } from '../../src/wiki/index-builder.js';

const sym = (id, name, kind = 'class') => ({
  id, file: 'x.ts', name, kind, exported: true, signature: 'x', bodyHash: 'h',
  imports: [], references: [], location: { row: 1, col: 0 },
});

test('groups pages by category prefix', () => {
  const snap = { version: 1, files: {}, symbols: [sym('a::Foo::class', 'Foo'), sym('b::Bar::function', 'Bar', 'function')] };
  const sourcemap = {
    pages: {
      'entities/Foo.md': { symbols: ['a::Foo::class'], files: ['a'] },
      'logic/Bar.md': { symbols: ['b::Bar::function'], files: ['b'] },
    },
  };
  const pages = new Map([
    ['entities/Foo.md', '# Foo\n\nFoo description.'],
    ['logic/Bar.md', '# Bar\n\nBar description.'],
  ]);
  const out = buildIndex({ sourcemap, snapshot: snap, pages });
  assert.match(out, /## Entities/);
  assert.match(out, /## Logic/);
  assert.match(out, /\[Foo\]\(entities\/Foo\.md\) — Foo description\./);
  assert.match(out, /\[Bar\]\(logic\/Bar\.md\) — Bar description\./);
});

test('omits index.md itself', () => {
  const snap = { version: 1, files: {}, symbols: [sym('a::Foo::class', 'Foo')] };
  const sourcemap = {
    pages: {
      'index.md': { symbols: [], files: [] },
      'entities/Foo.md': { symbols: ['a::Foo::class'], files: ['a'] },
    },
  };
  const out = buildIndex({ sourcemap, snapshot: snap, pages: new Map([['entities/Foo.md', '# Foo\n\nDesc.']]) });
  assert.equal(/\(index\.md\)/.test(out), false);
});

test('entities listed before logic', () => {
  const snap = { version: 1, files: {}, symbols: [sym('a::Foo::class', 'Foo'), sym('b::Bar::function', 'Bar', 'function')] };
  const sourcemap = {
    pages: {
      'entities/Foo.md': { symbols: ['a::Foo::class'], files: ['a'] },
      'logic/Bar.md': { symbols: ['b::Bar::function'], files: ['b'] },
    },
  };
  const pages = new Map([['entities/Foo.md', '# Foo\n\n'], ['logic/Bar.md', '# Bar\n\n']]);
  const out = buildIndex({ sourcemap, snapshot: snap, pages });
  assert.ok(out.indexOf('## Entities') < out.indexOf('## Logic'));
});
