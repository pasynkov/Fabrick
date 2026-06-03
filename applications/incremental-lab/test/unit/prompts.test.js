import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePagePrompt, patchPagePrompt, judgePrompt, JUDGE_SCHEMA } from '../../src/llm/prompts.js';

const sym = (file, name, kind = 'class') => ({
  id: `${file}::${name}::${kind}`, file, name, kind, exported: true,
  signature: 'x', bodyHash: 'h', imports: [], references: [], location: { row: 1, col: 0 },
});

test('generatePagePrompt includes slug, symbol ids, source code', () => {
  const p = generatePagePrompt({
    slug: 'entities/User',
    symbols: [sym('src/u.ts', 'User')],
    sources: [{ file: 'src/u.ts', content: 'export class User {}' }],
  });
  assert.match(p, /PAGE SLUG: entities\/User/);
  assert.match(p, /src\/u\.ts::User::class/);
  assert.match(p, /export class User \{\}/);
  assert.match(p, /Return ONLY the markdown content/);
});

test('patchPagePrompt includes existing page and changes', () => {
  const p = patchPagePrompt({
    slug: 'entities/User',
    existingPage: '# User\n\nold description',
    changes: ['sig:User.email', 'cascade-sig:User→Order'],
    symbols: [sym('src/u.ts', 'User')],
    sources: [{ file: 'src/u.ts', content: 'export class User { email: string | null; }' }],
  });
  assert.match(p, /old description/);
  assert.match(p, /sig:User\.email/);
  assert.match(p, /cascade-sig:User→Order/);
  assert.match(p, /email: string \| null/);
});

test('judgePrompt requests JSON output', () => {
  const p = judgePrompt({ pageA: 'A content', pageB: 'B content' });
  assert.match(p, /PAGE A:/);
  assert.match(p, /PAGE B:/);
  assert.match(p, /A content/);
  assert.match(p, /B content/);
  assert.match(p, /Output ONLY a single JSON object/);
});

test('JUDGE_SCHEMA has equivalent/score/differences fields', () => {
  assert.equal(JUDGE_SCHEMA.type, 'object');
  assert.deepEqual(JUDGE_SCHEMA.required.sort(), ['differences', 'equivalent', 'score']);
});
