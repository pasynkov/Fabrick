import test from 'node:test';
import assert from 'node:assert/strict';
import { diffSnapshots } from '../../src/diff/diff.js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSnapshot } from '../../src/snapshot/snapshot.js';

function makeRepo(files) {
  const root = mkdtempSync(join(tmpdir(), 'inc-lab-diff-'));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

function snap(files) {
  const root = makeRepo(files);
  try { return buildSnapshot(root); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

test('empty diff for identical snapshots', () => {
  const a = snap({ 'a.ts': `export function f() {}` });
  const b = snap({ 'a.ts': `export function f() {}` });
  const d = diffSnapshots(a, b);
  assert.deepEqual(d.files, { added: [], deleted: [], changed: [] });
  assert.equal(d.symbols.added.length, 0);
  assert.equal(d.symbols.deleted.length, 0);
  assert.equal(d.symbols.sigChanged.length, 0);
  assert.equal(d.symbols.bodyChanged.length, 0);
});

test('added file produces added symbols', () => {
  const a = snap({ 'a.ts': `export function f() {}` });
  const b = snap({ 'a.ts': `export function f() {}`, 'b.ts': `export class B {}` });
  const d = diffSnapshots(a, b);
  assert.deepEqual(d.files.added, ['b.ts']);
  assert.equal(d.symbols.added.length, 1);
  assert.equal(d.symbols.added[0].name, 'B');
});

test('deleted file produces deleted symbols', () => {
  const a = snap({ 'a.ts': `export function f() {}`, 'b.ts': `export class B {}` });
  const b = snap({ 'a.ts': `export function f() {}` });
  const d = diffSnapshots(a, b);
  assert.deepEqual(d.files.deleted, ['b.ts']);
  assert.equal(d.symbols.deleted.length, 1);
  assert.equal(d.symbols.deleted[0].name, 'B');
});

test('signature change detected separately from body', () => {
  const a = snap({ 'a.ts': `export function f(x: number) { return x; }` });
  const b = snap({ 'a.ts': `export function f(x: number, y: number) { return x; }` });
  const d = diffSnapshots(a, b);
  assert.equal(d.symbols.sigChanged.length, 1);
  assert.equal(d.symbols.bodyChanged.length, 0);
  assert.equal(d.symbols.sigChanged[0].before.signature !== d.symbols.sigChanged[0].after.signature, true);
});

test('body-only change does not show as sig change', () => {
  const a = snap({ 'a.ts': `export function f(x: number) { return x; }` });
  const b = snap({ 'a.ts': `export function f(x: number) { return x + 1; }` });
  const d = diffSnapshots(a, b);
  assert.equal(d.symbols.sigChanged.length, 0);
  assert.equal(d.symbols.bodyChanged.length, 1);
});

test('whitespace-only change is no-op', () => {
  const a = snap({ 'a.ts': `export function f(){ return 1; }` });
  const b = snap({ 'a.ts': `export function f(){\n  return 1;\n}` });
  const d = diffSnapshots(a, b);
  // file hash differs but symbol level should be silent
  assert.equal(d.symbols.sigChanged.length, 0);
  assert.equal(d.symbols.bodyChanged.length, 0);
});

test('rename function = delete + add', () => {
  const a = snap({ 'a.ts': `export function foo() {}` });
  const b = snap({ 'a.ts': `export function bar() {}` });
  const d = diffSnapshots(a, b);
  assert.equal(d.symbols.added.length, 1);
  assert.equal(d.symbols.deleted.length, 1);
  assert.equal(d.symbols.added[0].name, 'bar');
  assert.equal(d.symbols.deleted[0].name, 'foo');
});

test('import added/removed detected at file level', () => {
  const a = snap({ 'a.ts': `import { X } from './x';\nexport function f(){ return X; }` });
  const b = snap({ 'a.ts': `import { Y } from './y';\nexport function f(){ return Y; }` });
  const d = diffSnapshots(a, b);
  assert.equal(d.importsChanged.length, 1);
  assert.deepEqual(d.importsChanged[0].addedImports, ['./y']);
  assert.deepEqual(d.importsChanged[0].removedImports, ['./x']);
});
