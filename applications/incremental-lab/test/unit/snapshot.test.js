import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSnapshot } from '../../src/snapshot/snapshot.js';
import { writeSnapshot, readSnapshot, stableJson } from '../../src/snapshot/store.js';

function makeRepo(files) {
  const root = mkdtempSync(join(tmpdir(), 'inc-lab-'));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

test('stableJson sorts object keys recursively', () => {
  const out = stableJson({ b: 2, a: { y: 1, x: 2 } });
  assert.equal(out, `{\n  "a": {\n    "x": 2,\n    "y": 1\n  },\n  "b": 2\n}\n`);
});

test('buildSnapshot walks and extracts symbols', () => {
  const root = makeRepo({
    'src/a.ts': `export function foo() {}`,
    'src/b.ts': `export class Bar { run() {} }`,
    'node_modules/skip.ts': `export const SHOULD_SKIP = 1;`,
  });
  try {
    const snap = buildSnapshot(root);
    assert.equal(snap.version, 1);
    assert.deepEqual(Object.keys(snap.files).sort(), ['src/a.ts', 'src/b.ts']);
    const ids = snap.symbols.map((s) => s.id);
    assert.ok(ids.includes('src/a.ts::foo::function'));
    assert.ok(ids.includes('src/b.ts::Bar::class'));
    assert.ok(ids.includes('src/b.ts::Bar.run::method'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('snapshot is deterministic across builds of same input', () => {
  const root = makeRepo({
    'a.ts': `export class A {}`,
    'b.ts': `export class B {}`,
  });
  try {
    const s1 = buildSnapshot(root);
    const s2 = buildSnapshot(root);
    assert.equal(stableJson(s1), stableJson(s2));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('write+read snapshot round-trip', () => {
  const root = makeRepo({ 'x.ts': `export function fn() { return 1; }` });
  const outDir = mkdtempSync(join(tmpdir(), 'inc-lab-snap-'));
  try {
    const snap = buildSnapshot(root);
    writeSnapshot(outDir, snap);
    const loaded = readSnapshot(outDir);
    assert.deepEqual(loaded, snap);
    assert.ok(readFileSync(join(outDir, 'files.json'), 'utf8').endsWith('\n'));
    assert.ok(readFileSync(join(outDir, 'symbols.json'), 'utf8').endsWith('\n'));
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('file hash changes when content changes', () => {
  const root = makeRepo({ 'x.ts': `export function fn() {}` });
  try {
    const s1 = buildSnapshot(root);
    writeFileSync(join(root, 'x.ts'), `export function fn() { return 2; }`);
    const s2 = buildSnapshot(root);
    assert.notEqual(s1.files['x.ts'].hash, s2.files['x.ts'].hash);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
