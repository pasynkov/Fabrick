import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWikiSections, diffWikiSections, filterContentChanges } from '../../src/synthesis/section-diff.js';

test('parseWikiSections separates frontmatter, intro, and headers', () => {
  const body = `---
slug: entities/Foo
---

# Foo

Intro paragraph.

## Symbols
- Foo

## Notes
note line
`;
  const p = parseWikiSections(body);
  assert.match(p.frontmatter, /slug: entities\/Foo/);
  assert.match(p.intro, /# Foo/);
  assert.match(p.intro, /Intro paragraph/);
  assert.equal(p.sections['## Symbols'], '- Foo');
  assert.match(p.sections['## Notes'], /note line/);
});

test('diff: cosmetic-only when only Related changes', () => {
  const a = `# T\n\nbody.\n\n## Symbols\n- X\n\n## Related\n- [Old](old.md)\n`;
  const b = `# T\n\nbody.\n\n## Symbols\n- X\n\n## Related\n- [New](new.md)\n`;
  const d = diffWikiSections(a, b);
  assert.equal(d.isContentChange, false);
  assert.equal(d.isCosmeticOnly, true);
});

test('diff: cosmetic-only when only frontmatter changes', () => {
  const a = `---\nupdated: 2026-01-01\n---\n\n# T\n\nbody.\n`;
  const b = `---\nupdated: 2026-06-01\n---\n\n# T\n\nbody.\n`;
  const d = diffWikiSections(a, b);
  assert.equal(d.isContentChange, false);
  assert.equal(d.isCosmeticOnly, true);
});

test('diff: content change when Symbols section changes', () => {
  const a = `# T\n\nbody.\n\n## Symbols\n- X\n`;
  const b = `# T\n\nbody.\n\n## Symbols\n- X\n- Y\n`;
  const d = diffWikiSections(a, b);
  assert.equal(d.isContentChange, true);
  assert.equal(d.changedSections.length, 1);
  assert.equal(d.changedSections[0].header, '## Symbols');
});

test('diff: content change when intro changes', () => {
  const a = `# T\n\nold intro.\n\n## Symbols\n- X\n`;
  const b = `# T\n\nnew intro.\n\n## Symbols\n- X\n`;
  const d = diffWikiSections(a, b);
  assert.equal(d.introChanged, true);
  assert.equal(d.isContentChange, true);
});

test('filterContentChanges: cosmetic edits go to cosmeticOnly bucket', () => {
  const before = {
    'p1': `# T\n\nbody.\n\n## Related\n- [X](x.md)\n`,
    'p2': `# T2\n\nbody.\n\n## Symbols\n- X\n`,
  };
  const after = {
    'p1': `# T\n\nbody.\n\n## Related\n- [Y](y.md)\n`,    // cosmetic
    'p2': `# T2\n\nbody.\n\n## Symbols\n- X\n- Y\n`,      // content
  };
  const f = filterContentChanges(before, after);
  assert.equal(f.changed.length, 1);
  assert.equal(f.changed[0].slug, 'p2');
  assert.equal(f.cosmeticOnly.length, 1);
  assert.equal(f.cosmeticOnly[0].slug, 'p1');
});

test('filterContentChanges: added / deleted detected', () => {
  const before = { 'p1': `# T\n`, 'p2': `# X\n` };
  const after = { 'p1': `# T\n`, 'p3': `# Z\n` };
  const f = filterContentChanges(before, after);
  assert.deepEqual(f.added.map((x) => x.slug), ['p3']);
  assert.deepEqual(f.deleted, ['p2']);
});
