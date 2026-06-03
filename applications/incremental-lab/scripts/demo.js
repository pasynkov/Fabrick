#!/usr/bin/env node
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { simpleGit } from 'simple-git';
import { buildSnapshot } from '../src/snapshot/snapshot.js';
import { diffSnapshots } from '../src/diff/diff.js';
import { invalidate } from '../src/invalidate/invalidate.js';
import { synthSourcemap, applyInvalidation } from '../src/bench/synth-sourcemap.js';
import { stableJson, writeSnapshot, writeSourcemap } from '../src/snapshot/store.js';
import { generatePage, patchPage } from '../src/llm/page-generator.js';
import { computeRelated } from '../src/wiki/related.js';
import { assemblePage } from '../src/wiki/page-assembly.js';
import { buildIndex } from '../src/wiki/index-builder.js';

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--'));
const app = positional[0] ?? 'mcp';
const beforeSha = positional[1];
const afterSha = positional[2];
const repoRoot = resolve(argv.find((a) => a.startsWith('--repo='))?.split('=')[1] ?? '../..');
const subdir = `applications/${app}`;

if (!existsSync(join(repoRoot, '.git'))) { console.error(`No .git at ${repoRoot}`); process.exit(1); }
if (!existsSync(join(repoRoot, subdir))) { console.error(`No ${subdir} at ${repoRoot}`); process.exit(1); }

const outRoot = join(process.cwd(), '.lab', 'demo', app);
rmSync(outRoot, { recursive: true, force: true });
const fullDir = join(outRoot, '01-full-scan');
const patchDir = join(outRoot, '02-patch');
const afterDir = join(outRoot, '03-after');
mkdirSync(join(fullDir, 'wiki'), { recursive: true });
mkdirSync(patchDir, { recursive: true });
mkdirSync(join(afterDir, 'wiki'), { recursive: true });

const tmp = mkdtempSync(join(tmpdir(), 'demo-'));
console.log(`[clone] ${repoRoot} → ${tmp}`);
await simpleGit(repoRoot).clone(repoRoot, tmp, ['--no-local']).catch(async () =>
  simpleGit(repoRoot).clone(repoRoot, tmp),
);
const git = simpleGit(tmp);
const subPath = join(tmp, subdir);

let chosenBefore = beforeSha;
let chosenAfter = afterSha;
if (!chosenBefore || !chosenAfter) {
  const log = await git.log({ maxCount: 30, file: subdir });
  const commits = log.all.map((c) => c.hash).reverse();
  let foundIdx = -1;
  for (let i = 1; i < commits.length; i++) {
    await git.checkout(commits[i - 1]);
    const a = buildSnapshot(subPath);
    await git.checkout(commits[i]);
    const b = buildSnapshot(subPath);
    const d = diffSnapshots(a, b);
    const touched = d.symbols.added.length + d.symbols.deleted.length + d.symbols.sigChanged.length + d.symbols.bodyChanged.length;
    if (touched > 0 && touched <= 6) { foundIdx = i; chosenBefore = commits[i - 1]; chosenAfter = commits[i]; break; }
  }
  if (foundIdx < 0) { console.error('Could not auto-pick a commit pair with 1..6 changes'); process.exit(1); }
}
console.log(`[commits] before=${chosenBefore.slice(0, 7)}  after=${chosenAfter.slice(0, 7)}`);

console.log(`\n=== PHASE 1: full scan @ ${chosenBefore.slice(0, 7)} ===`);
await git.checkout(chosenBefore);
const beforeSnap = buildSnapshot(subPath);
const beforeSmap = synthSourcemap(beforeSnap);
writeSnapshot(fullDir, beforeSnap);
writeSourcemap(fullDir, beforeSmap);
console.log(`  files=${Object.keys(beforeSnap.files).length}  symbols=${beforeSnap.symbols.length}  pages=${Object.keys(beforeSmap.pages).length - 1}`);

const beforePages = new Map();
const beforePageBodies = new Map();
let scanCost = 0;
for (const [slug, page] of Object.entries(beforeSmap.pages)) {
  if (slug === 'index.md') continue;
  if (page.symbols.length === 0) continue;
  const symbols = beforeSnap.symbols.filter((s) => page.symbols.includes(s.id));
  process.stdout.write(`  [gen] ${slug} ... `);
  const res = await generatePage({ slug, symbols, repoRoot: subPath });
  beforePageBodies.set(slug, res.content);
  scanCost += res.costUsd ?? 0;
  const related = computeRelated({ slug, sourcemap: beforeSmap, snapshot: beforeSnap });
  const assembled = assemblePage({
    slug, body: res.content, page,
    sourcemap: beforeSmap, snapshot: beforeSnap,
    relatedSlugs: related, updated: chosenBefore.slice(0, 7),
  });
  beforePages.set(slug, assembled);
  writeFileSync(join(fullDir, 'wiki', slug.replace(/[/]/g, '_')), assembled);
  console.log(`$${(res.costUsd ?? 0).toFixed(4)}`);
}
const beforeIndex = buildIndex({ sourcemap: beforeSmap, snapshot: beforeSnap, pages: beforePages, updated: chosenBefore.slice(0, 7) });
beforePages.set('index.md', beforeIndex);
writeFileSync(join(fullDir, 'wiki', 'index.md'), beforeIndex);
console.log(`  scan cost: $${scanCost.toFixed(4)}`);

console.log(`\n=== PHASE 2: detect changes & build patch plan ===`);
await git.checkout(chosenAfter);
const afterSnap = buildSnapshot(subPath);
const diff = diffSnapshots(beforeSnap, afterSnap);
const inv = invalidate({ diff, sourcemap: beforeSmap, currentSymbols: afterSnap.symbols });

writeFileSync(join(patchDir, '01-diff.json'), stableJson({
  files: diff.files,
  symbols: {
    added: diff.symbols.added.map((s) => ({ id: s.id, kind: s.kind, name: s.name, exported: s.exported, signature: s.signature })),
    deleted: diff.symbols.deleted.map((s) => ({ id: s.id, kind: s.kind, name: s.name, signature: s.signature })),
    sigChanged: diff.symbols.sigChanged.map((c) => ({ id: c.after.id, before: c.before.signature, after: c.after.signature })),
    bodyChanged: diff.symbols.bodyChanged.map((c) => ({ id: c.after.id, name: c.after.name })),
  },
  importsChanged: diff.importsChanged,
}));
writeFileSync(join(patchDir, '02-invalidation.json'), stableJson({
  pagesInvalidated: inv.pagesInvalidated,
  pagesDeleted: inv.pagesDeleted,
  newSymbols: inv.newSymbols.map((s) => ({ id: s.id, kind: s.kind, name: s.name, file: s.file })),
  reasons: inv.reasons,
}));
console.log(`  diff: +${diff.symbols.added.length} -${diff.symbols.deleted.length}  sig=${diff.symbols.sigChanged.length}  body=${diff.symbols.bodyChanged.length}`);
console.log(`  invalidated: ${inv.pagesInvalidated.join(', ') || '(none)'}`);
console.log(`  deleted:     ${inv.pagesDeleted.join(', ') || '(none)'}`);
console.log(`  new:         ${inv.newSymbols.map((s) => s.name).join(', ') || '(none)'}`);

let patchCost = 0;
const patchRecords = [];
const newOrPatchedBodies = new Map();

for (const slug of inv.pagesInvalidated) {
  if (slug === 'index.md') continue;
  const page = beforeSmap.pages[slug];
  if (!page || page.symbols.length === 0) continue;
  const symbols = afterSnap.symbols.filter((s) => page.symbols.includes(s.id));
  if (symbols.length === 0) continue;
  const slugSafe = slug.replace(/[/]/g, '_').replace(/\.md$/, '');
  const perSlugDir = join(patchDir, 'patches', slugSafe);
  mkdirSync(perSlugDir, { recursive: true });
  const existingBody = beforePageBodies.get(slug) ?? '';
  writeFileSync(join(perSlugDir, '01-existing-body.md'), existingBody);
  writeFileSync(join(perSlugDir, '02-change-reasons.txt'), (inv.reasons[slug] ?? []).join('\n') + '\n');
  console.log(`  [patch] ${slug} ...`);
  const res = await patchPage({
    slug, existingPage: existingBody, changes: inv.reasons[slug] ?? [],
    symbols, repoRoot: subPath,
  });
  writeFileSync(join(perSlugDir, '03-prompt.txt'), res.prompt);
  writeFileSync(join(perSlugDir, '04-llm-raw-response.md'), res.rawResponse);
  writeFileSync(join(perSlugDir, '05-llm-body-trimmed.md'), res.content);
  newOrPatchedBodies.set(slug, res.content);
  patchCost += res.costUsd ?? 0;
  patchRecords.push({ slug, action: 'patch', costUsd: res.costUsd, usage: res.usage, promptBytes: res.prompt.length, responseBytes: res.rawResponse.length });
}

for (const sym of inv.newSymbols) {
  const slug = `${slugDir(sym.kind)}/${sym.name}.md`;
  const symbols = afterSnap.symbols.filter((s) => s.file === sym.file && (s.name === sym.name || s.name.startsWith(sym.name + '.')));
  if (symbols.length === 0) continue;
  const slugSafe = slug.replace(/[/]/g, '_').replace(/\.md$/, '');
  const perSlugDir = join(patchDir, 'patches', slugSafe);
  mkdirSync(perSlugDir, { recursive: true });
  console.log(`  [new]   ${slug} ...`);
  const res = await generatePage({ slug, symbols, repoRoot: subPath });
  writeFileSync(join(perSlugDir, '03-prompt.txt'), res.prompt);
  writeFileSync(join(perSlugDir, '04-llm-raw-response.md'), res.rawResponse);
  writeFileSync(join(perSlugDir, '05-llm-body-trimmed.md'), res.content);
  newOrPatchedBodies.set(slug, res.content);
  patchCost += res.costUsd ?? 0;
  patchRecords.push({ slug, action: 'new', costUsd: res.costUsd, usage: res.usage, promptBytes: res.prompt.length, responseBytes: res.rawResponse.length });
}

writeFileSync(join(patchDir, '03-patch-summary.json'), stableJson({
  totalPatchCostUsd: patchCost,
  patches: patchRecords,
}));
console.log(`  patch cost: $${patchCost.toFixed(4)}`);

console.log(`\n=== PHASE 3: apply patches & save after-state ===`);
const afterSmap = applyInvalidation({ sourcemap: beforeSmap, invalidation: inv, newSnapshot: afterSnap });
writeSnapshot(afterDir, afterSnap);
writeSourcemap(afterDir, afterSmap);

const afterPages = new Map();
const afterPageBodies = new Map(beforePageBodies);
for (const slug of inv.pagesDeleted) afterPageBodies.delete(slug);
for (const [slug, body] of newOrPatchedBodies) afterPageBodies.set(slug, body);

for (const [slug, body] of afterPageBodies) {
  const page = afterSmap.pages[slug];
  if (!page) continue;
  const related = computeRelated({ slug, sourcemap: afterSmap, snapshot: afterSnap });
  const assembled = assemblePage({
    slug, body, page,
    sourcemap: afterSmap, snapshot: afterSnap,
    relatedSlugs: related, updated: chosenAfter.slice(0, 7),
  });
  afterPages.set(slug, assembled);
  writeFileSync(join(afterDir, 'wiki', slug.replace(/[/]/g, '_')), assembled);
}
const afterIndex = buildIndex({ sourcemap: afterSmap, snapshot: afterSnap, pages: afterPages, updated: chosenAfter.slice(0, 7) });
afterPages.set('index.md', afterIndex);
writeFileSync(join(afterDir, 'wiki', 'index.md'), afterIndex);
console.log(`  pages after: ${afterPages.size}`);

writeFileSync(join(outRoot, 'README.md'), `# Demo: ${app}  (${chosenBefore.slice(0, 7)} → ${chosenAfter.slice(0, 7)})

## Layout

\`\`\`
01-full-scan/                 baseline LLM-generated wiki at ${chosenBefore.slice(0, 7)}
  files.json                  file hash map
  symbols.json                extracted symbols
  sourcemap.json              page → symbols/files
  wiki/                       assembled .md pages (frontmatter + body + Related)

02-patch/                     patch plan + per-page LLM calls
  01-diff.json                symbol-level diff (sig vs body vs add/del)
  02-invalidation.json        which pages are touched, reasons per page
  03-patch-summary.json       cost + usage per call
  patches/<slug>/
    01-existing-body.md       what we sent as "existing page" to LLM
    02-change-reasons.txt     invalidator reason strings
    03-prompt.txt             FULL prompt sent to LLM
    04-llm-raw-response.md    raw LLM stdout (untouched)
    05-llm-body-trimmed.md    LLM body, trimmed for assembly

03-after/                     state after applying all patches
  snapshot.json + symbols.json + files.json
  sourcemap.json
  wiki/                       assembled .md pages reflecting new state
\`\`\`

## Numbers

- scan cost (full baseline): \$${scanCost.toFixed(4)}
- patch cost (this commit):  \$${patchCost.toFixed(4)}
- pages before: ${beforePages.size}
- pages after:  ${afterPages.size}
- patches: ${patchRecords.length}
`);

console.log(`\n[done] outputs in ${outRoot}`);
console.log(`        scan $${scanCost.toFixed(4)}  patch $${patchCost.toFixed(4)}  total $${(scanCost + patchCost).toFixed(4)}`);

rmSync(tmp, { recursive: true, force: true });

function slugDir(kind) {
  return ({ class: 'entities', interface: 'entities', type: 'types', function: 'logic', enum: 'enums', const: 'consts' }[kind] ?? 'misc');
}
