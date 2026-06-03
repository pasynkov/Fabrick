import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { buildSnapshot } from '../src/snapshot/snapshot.js';
import { diffSnapshots } from '../src/diff/diff.js';
import { invalidate } from '../src/invalidate/invalidate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');

const fixtures = readdirSync(FIXTURES_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

for (const name of fixtures) {
  test(`fixture: ${name}`, () => {
    const dir = join(FIXTURES_DIR, name);
    const expected = yaml.load(readFileSync(join(dir, 'expected.yaml'), 'utf8'));
    const sourcemap = JSON.parse(readFileSync(join(dir, 'sourcemap.json'), 'utf8'));

    const before = buildSnapshot(join(dir, 'baseline'));
    const after = buildSnapshot(join(dir, 'after'));
    const diff = diffSnapshots(before, after);
    const result = invalidate({ diff, sourcemap, currentSymbols: after.symbols });

    const actualPagesInvalidated = result.pagesInvalidated;
    const actualPagesDeleted = result.pagesDeleted;
    const actualNewSymbols = result.newSymbols.map((s) => s.name).sort();
    const expectedPagesInvalidated = (expected.pagesInvalidated ?? []).sort();
    const expectedPagesDeleted = (expected.pagesDeleted ?? []).sort();
    const expectedNewSymbols = (expected.newSymbols ?? []).sort();

    assert.deepEqual(actualPagesInvalidated, expectedPagesInvalidated,
      `${name}: pagesInvalidated mismatch\n  expected: ${expectedPagesInvalidated.join(', ')}\n  actual:   ${actualPagesInvalidated.join(', ')}\n  reasons:  ${JSON.stringify(result.reasons, null, 2)}`);
    assert.deepEqual(actualPagesDeleted, expectedPagesDeleted,
      `${name}: pagesDeleted mismatch`);
    assert.deepEqual(actualNewSymbols, expectedNewSymbols,
      `${name}: newSymbols mismatch`);
  });
}
