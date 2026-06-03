import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDescription, buildFrontmatter, buildRelatedSection, stripRelatedSection, assemblePage } from '../../src/wiki/page-assembly.js';

test('extractDescription returns first paragraph after H1', () => {
  const md = `# Title\n\nFirst paragraph describing the thing.\n\nSecond paragraph.`;
  assert.equal(extractDescription(md), 'First paragraph describing the thing.');
});

test('extractDescription ignores frontmatter', () => {
  const md = `---\nslug: foo\n---\n\n# Title\n\nDescription line.`;
  assert.equal(extractDescription(md), 'Description line.');
});

test('extractDescription truncates long descriptions', () => {
  const long = 'x'.repeat(200);
  const md = `# T\n\n${long}`;
  const d = extractDescription(md);
  assert.ok(d.length <= 160);
  assert.ok(d.endsWith('...'));
});

test('buildFrontmatter writes slug, symbols, files', () => {
  const f = buildFrontmatter({
    slug: 'entities/Foo.md',
    page: { symbols: ['a.ts::Foo::class'], files: ['a.ts'] },
    updated: '2026-06-03',
  });
  assert.match(f, /slug: entities\/Foo/);
  assert.match(f, /- a\.ts::Foo::class/);
  assert.match(f, /- a\.ts/);
  assert.match(f, /updated: 2026-06-03/);
});

test('stripRelatedSection removes existing Related section', () => {
  const md = `# Title\n\nBody.\n\n## Related\n\n- [Bar](bar.md)\n`;
  const out = stripRelatedSection(md);
  assert.equal(/## Related/.test(out), false);
  assert.match(out, /Body\./);
});

test('buildRelatedSection composes link list with titles', () => {
  const sym = (id, name) => ({ id, file: 'x.ts', name, kind: 'class', exported: true, signature: 'x', bodyHash: 'h', imports: [], references: [], location: { row: 1, col: 0 } });
  const snap = { version: 1, files: {}, symbols: [sym('a.ts::Bar::class', 'Bar')] };
  const sourcemap = { pages: { 'entities/Bar.md': { symbols: ['a.ts::Bar::class'], files: ['a.ts'] } } };
  const out = buildRelatedSection({ relatedSlugs: ['entities/Bar.md'], sourcemap, snapshot: snap });
  assert.match(out, /## Related/);
  assert.match(out, /\[Bar\]\(entities\/Bar\.md\)/);
});

test('assemblePage stitches frontmatter, body, related', () => {
  const snap = { version: 1, files: {}, symbols: [] };
  const sourcemap = { pages: { 'entities/Foo.md': { symbols: ['a.ts::Foo::class'], files: ['a.ts'] }, 'entities/Bar.md': { symbols: ['b.ts::Bar::class'], files: ['b.ts'] } } };
  const body = `# Foo\n\nFoo describes a thing.\n`;
  const out = assemblePage({
    slug: 'entities/Foo.md',
    body,
    page: sourcemap.pages['entities/Foo.md'],
    sourcemap,
    snapshot: snap,
    relatedSlugs: ['entities/Bar.md'],
    updated: '2026-06-03',
  });
  assert.match(out, /^---/);
  assert.match(out, /# Foo/);
  assert.match(out, /## Related/);
  assert.match(out, /entities\/Bar\.md/);
});
