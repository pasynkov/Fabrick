import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConsumerIndex, cascadeFrom } from '../../src/cascade/cascade.js';

const sym = (file, name, refs = []) => ({
  id: `${file}::${name}::function`,
  file, name, kind: 'function', exported: true, signature: `function ${name}()`,
  bodyHash: 'h', imports: [], references: refs, location: { row: 1, col: 0 },
});

test('consumer index maps reference name to consumers', () => {
  const symbols = [sym('a.ts', 'foo'), sym('b.ts', 'bar', ['foo'])];
  const idx = buildConsumerIndex(symbols);
  assert.equal(idx.get('foo').length, 1);
  assert.equal(idx.get('foo')[0].name, 'bar');
});

test('cascadeFrom respects depth=0', () => {
  const idx = buildConsumerIndex([sym('a.ts', 'foo'), sym('b.ts', 'bar', ['foo'])]);
  assert.deepEqual(cascadeFrom('foo', idx, 0), []);
});

test('cascadeFrom L1', () => {
  const idx = buildConsumerIndex([sym('a.ts', 'foo'), sym('b.ts', 'bar', ['foo']), sym('c.ts', 'baz', ['bar'])]);
  const out = cascadeFrom('foo', idx, 1);
  assert.deepEqual(out.map((s) => s.name).sort(), ['bar']);
});

test('cascadeFrom L2 walks transitively', () => {
  const idx = buildConsumerIndex([
    sym('a.ts', 'foo'),
    sym('b.ts', 'bar', ['foo']),
    sym('c.ts', 'baz', ['bar']),
    sym('d.ts', 'qux', ['baz']),
  ]);
  const out = cascadeFrom('foo', idx, 2);
  const names = out.map((s) => s.name).sort();
  assert.deepEqual(names, ['bar', 'baz']);
});

test('cascadeFrom unlimited reaches everything', () => {
  const idx = buildConsumerIndex([
    sym('a.ts', 'foo'),
    sym('b.ts', 'bar', ['foo']),
    sym('c.ts', 'baz', ['bar']),
    sym('d.ts', 'qux', ['baz']),
  ]);
  const out = cascadeFrom('foo', idx, Infinity);
  assert.deepEqual(out.map((s) => s.name).sort(), ['bar', 'baz', 'qux']);
});

test('cycle does not loop forever', () => {
  const idx = buildConsumerIndex([
    sym('a.ts', 'foo', ['bar']),
    sym('b.ts', 'bar', ['foo']),
  ]);
  const out = cascadeFrom('foo', idx, Infinity);
  assert.deepEqual(out.map((s) => s.name).sort(), ['bar']);
});
