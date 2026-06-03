import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSlimChangeContext, currentSymbolSignatures } from '../../src/llm/diff-context.js';

const sym = (file, name, kind, sig = `${kind} ${name}`) => ({
  id: `${file}::${name}::${kind}`, file, name, kind, exported: true,
  signature: sig, bodyHash: 'h', imports: [], references: [], location: { row: 1, col: 0 },
});

const emptyDiff = () => ({
  files: { added: [], deleted: [], changed: [] },
  symbols: { added: [], deleted: [], sigChanged: [], bodyChanged: [] },
  importsChanged: [],
});

test('signature change with before/after', () => {
  const a = sym('f.ts', 'foo', 'function', 'function foo(x: number)');
  const b = sym('f.ts', 'foo', 'function', 'function foo(x: number, y: number)');
  const diff = emptyDiff();
  diff.symbols.sigChanged = [{ before: a, after: b }];
  const ctx = buildSlimChangeContext({ pageSymbolIds: new Set([a.id]), diff });
  assert.match(ctx, /SIGNATURE CHANGED: foo/);
  assert.match(ctx, /before: function foo\(x: number\)/);
  assert.match(ctx, /after:  function foo\(x: number, y: number\)/);
});

test('body change without signature', () => {
  const a = sym('f.ts', 'foo', 'function');
  const diff = emptyDiff();
  diff.symbols.bodyChanged = [{ before: a, after: a }];
  const ctx = buildSlimChangeContext({ pageSymbolIds: new Set([a.id]), diff });
  assert.match(ctx, /BODY CHANGED \(signature unchanged\): foo/);
});

test('added symbol shows signature', () => {
  const x = sym('f.ts', 'newOne', 'function', 'function newOne(): void');
  const diff = emptyDiff();
  diff.symbols.added = [x];
  const ctx = buildSlimChangeContext({ pageSymbolIds: new Set(), diff });
  assert.match(ctx, /ADDED: newOne/);
  assert.match(ctx, /signature: function newOne\(\): void/);
});

test('removed symbol shows old signature', () => {
  const x = sym('f.ts', 'gone', 'function');
  const diff = emptyDiff();
  diff.symbols.deleted = [x];
  const ctx = buildSlimChangeContext({ pageSymbolIds: new Set([x.id]), diff });
  assert.match(ctx, /REMOVED: gone/);
  assert.match(ctx, /was: function gone/);
});

test('only page-relevant sig/body/removed changes are included', () => {
  const onPage = sym('f.ts', 'onPage', 'function');
  const other = sym('g.ts', 'otherFn', 'function');
  const diff = emptyDiff();
  diff.symbols.sigChanged = [{ before: onPage, after: onPage }, { before: other, after: other }];
  const ctx = buildSlimChangeContext({ pageSymbolIds: new Set([onPage.id]), diff });
  assert.match(ctx, /SIGNATURE CHANGED: onPage/);
  assert.equal(/SIGNATURE CHANGED: otherFn/.test(ctx), false);
});

test('currentSymbolSignatures lists id + signature', () => {
  const out = currentSymbolSignatures({ symbols: [sym('f.ts', 'foo', 'function', 'function foo()')] });
  assert.match(out, /f\.ts::foo::function/);
  assert.match(out, /function foo\(\)/);
});
