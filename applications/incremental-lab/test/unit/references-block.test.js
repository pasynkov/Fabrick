import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReferencesBlock } from '../../src/llm/diff-context.js';

const sym = (id, name, refs = []) => ({
  id, file: 'x.ts', name, kind: 'class', exported: true, signature: 'x', bodyHash: 'h',
  imports: [], references: refs, location: { row: 1, col: 0 },
});

test('current references listed per page symbol', () => {
  const M = sym('m.ts::Mod::class', 'Mod', ['A', 'B']);
  const block = buildReferencesBlock({ pageSymbols: [M], beforeSymbols: [], afterSymbols: [M] });
  assert.match(block, /REFERENCED IDENTIFIERS PER SYMBOL ON THIS PAGE/);
  assert.match(block, /Mod: \[A, B\]/);
});

test('diff shows added/removed references', () => {
  const before = sym('m.ts::Mod::class', 'Mod', ['A', 'B']);
  const after = sym('m.ts::Mod::class', 'Mod', ['A', 'C']);
  const block = buildReferencesBlock({ pageSymbols: [after], beforeSymbols: [before], afterSymbols: [after] });
  assert.match(block, /CHANGES SINCE PREVIOUS SNAPSHOT/);
  assert.match(block, /added:   \[C\]/);
  assert.match(block, /removed: \[B\]/);
});

test('no diff block when nothing changed', () => {
  const M = sym('m.ts::Mod::class', 'Mod', ['A']);
  const block = buildReferencesBlock({ pageSymbols: [M], beforeSymbols: [M], afterSymbols: [M] });
  assert.equal(/CHANGES SINCE PREVIOUS SNAPSHOT/.test(block), false);
  assert.match(block, /Mod: \[A\]/);
});

test('symbols with no references contribute nothing to current list', () => {
  const M = sym('m.ts::Mod::class', 'Mod', []);
  const block = buildReferencesBlock({ pageSymbols: [M], beforeSymbols: [], afterSymbols: [M] });
  assert.equal(/Mod:/.test(block), false);
});
