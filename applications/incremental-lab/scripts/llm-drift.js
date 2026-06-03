#!/usr/bin/env node
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { simpleGit } from 'simple-git';
import { buildSnapshot } from '../src/snapshot/snapshot.js';
import { diffSnapshots } from '../src/diff/diff.js';
import { invalidate } from '../src/invalidate/invalidate.js';
import { synthSourcemap, applyInvalidation } from '../src/bench/synth-sourcemap.js';
import { structuralEquivalence } from '../src/validate/validate.js';
import { generatePage, patchPage } from '../src/llm/page-generator.js';
import { judge } from '../src/llm/judge.js';
import { stableJson } from '../src/snapshot/store.js';
import { computeRelated } from '../src/wiki/related.js';
import { assemblePage } from '../src/wiki/page-assembly.js';
import { buildIndex } from '../src/wiki/index-builder.js';

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--'));
const label = positional[0] ?? 'mcp';
const N = Number(argv.find((a) => a.startsWith('--commits='))?.split('=')[1] ?? 10);
const judgeSample = Number(argv.find((a) => a.startsWith('--judge-sample='))?.split('=')[1] ?? 3);
const maxCost = Number(argv.find((a) => a.startsWith('--max-cost='))?.split('=')[1] ?? 5);
const explicitRepo = argv.find((a) => a.startsWith('--repo='))?.split('=')[1];
const explicitSubdir = argv.find((a) => a.startsWith('--subdir='))?.split('=')[1];
const model = argv.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'sonnet';
const claudeOpts = { model };

let repoRoot;
let subdir;
const namiMatch = label.match(/^nami-(.+)$/);
if (explicitRepo) {
  repoRoot = resolve(explicitRepo);
  subdir = explicitSubdir ?? '.';
} else if (namiMatch) {
  const envKey = `NAMI_REPO_${namiMatch[1].toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const envPath = process.env[envKey];
  if (!envPath) { console.error(`Set ${envKey} in .env.local`); process.exit(1); }
  repoRoot = resolve(envPath);
  subdir = explicitSubdir ?? '.';
} else {
  repoRoot = resolve('../..');
  subdir = `applications/${label}`;
}
const app = label;
console.log(`[model] ${model}  (judge always sonnet for consistency)`);
console.log(`[source] repo=${repoRoot} subdir=${subdir}`);

if (!existsSync(join(repoRoot, '.git'))) { console.error(`No .git at ${repoRoot}`); process.exit(1); }
if (!existsSync(join(repoRoot, subdir))) { console.error(`No ${subdir} at ${repoRoot}`); process.exit(1); }

const outRoot = join(process.cwd(), '.lab', 'llm-drift', app);
const incrDir = join(outRoot, 'incr');
const fullDir = join(outRoot, 'full');
const reportPath = join(outRoot, 'report.json');
mkdirSync(incrDir, { recursive: true });
mkdirSync(fullDir, { recursive: true });

const tmp = mkdtempSync(join(tmpdir(), 'llm-drift-'));
console.log(`[clone] ${repoRoot} → ${tmp}`);
await simpleGit(repoRoot).clone(repoRoot, tmp, ['--no-local']).catch(async () =>
  simpleGit(repoRoot).clone(repoRoot, tmp),
);
const git = simpleGit(tmp);
const subPath = join(tmp, subdir);

const log = await git.log({ maxCount: N + 1, file: subdir });
if (log.all.length < 2) { console.error(`Not enough history (${log.all.length}).`); process.exit(1); }
const commits = log.all.map((c) => c.hash).reverse();
console.log(`[history] ${commits.length} commits, ${commits[0].slice(0, 7)} → ${commits.at(-1).slice(0, 7)}`);

let cumulativeCost = 0;
const callLog = [];

const log_call = (label, res) => {
  cumulativeCost += res.costUsd ?? 0;
  callLog.push({ label, cost: res.costUsd, in: res.usage?.input_tokens, out: res.usage?.output_tokens, wall: res.durationMs });
  if (cumulativeCost > maxCost) {
    throw new Error(`max cost $${maxCost} exceeded (now $${cumulativeCost.toFixed(2)})`);
  }
};

await git.checkout(commits[0]);
let snap = buildSnapshot(subPath);
let smap = synthSourcemap(snap);
console.log(`[baseline] files=${Object.keys(snap.files).length} symbols=${snap.symbols.length} pages=${Object.keys(smap.pages).length}`);

const pageBodies = new Map(); // slug → LLM body (no frontmatter/related)
const pages = new Map();      // slug → fully assembled markdown

const wrapAndStore = (slug, body, currentSmap, currentSnap, updated) => {
  pageBodies.set(slug, body);
  const related = computeRelated({ slug, sourcemap: currentSmap, snapshot: currentSnap });
  const assembled = assemblePage({
    slug, body, page: currentSmap.pages[slug],
    sourcemap: currentSmap, snapshot: currentSnap,
    relatedSlugs: related, updated,
  });
  pages.set(slug, assembled);
};

const regenIndex = (currentSmap, currentSnap, updated) => {
  const index = buildIndex({ sourcemap: currentSmap, snapshot: currentSnap, pages, updated });
  pages.set('index.md', index);
};

console.log(`[baseline-gen] generating ${Object.keys(smap.pages).length - 1} pages (index.md is mechanical)...`);
let i = 0;
for (const [slug, page] of Object.entries(smap.pages)) {
  i++;
  if (slug === 'index.md') continue;
  if (page.symbols.length === 0) continue;
  const symbols = snap.symbols.filter((s) => page.symbols.includes(s.id));
  if (symbols.length === 0) continue;
  process.stdout.write(`  [${i}/${Object.keys(smap.pages).length}] ${slug} ... `);
  const res = await generatePage({ slug, symbols, repoRoot: subPath, claudeOpts });
  wrapAndStore(slug, res.content, smap, snap, commits[0].slice(0, 7));
  log_call(`gen:${slug}`, res);
  console.log(`$${(res.costUsd ?? 0).toFixed(4)}  (cumulative $${cumulativeCost.toFixed(2)})`);
}
regenIndex(smap, snap, commits[0].slice(0, 7));
const baselineCost = cumulativeCost;
console.log(`[baseline-gen done] ${pages.size - 1} pages generated for $${baselineCost.toFixed(2)} (+ mechanical index)`);

const incrPatchCost = { value: 0 };
for (let step = 1; step < commits.length; step++) {
  const sha = commits[step];
  await git.checkout(sha);
  const before = snap;
  const after = buildSnapshot(subPath);
  const diff = diffSnapshots(before, after);
  const inv = invalidate({ diff, sourcemap: smap, currentSymbols: after.symbols });
  smap = applyInvalidation({ sourcemap: smap, invalidation: inv, newSnapshot: after });
  snap = after;

  for (const slug of inv.pagesDeleted) { pages.delete(slug); pageBodies.delete(slug); }

  for (const slug of inv.pagesInvalidated) {
    if (slug === 'index.md') continue;
    const page = smap.pages[slug];
    if (!page || page.symbols.length === 0) continue;
    const symbols = after.symbols.filter((s) => page.symbols.includes(s.id));
    if (symbols.length === 0) continue;
    const existingBody = pageBodies.get(slug) ?? '';
    const changeDescriptions = inv.reasons[slug] ?? [];
    const res = await patchPage({
      slug, existingPage: existingBody, changes: changeDescriptions,
      symbols, repoRoot: subPath, claudeOpts,
      beforeSnapshotSymbols: before.symbols, afterSnapshotSymbols: after.symbols,
    });
    wrapAndStore(slug, res.content, smap, after, sha.slice(0, 7));
    log_call(`patch:${sha.slice(0, 7)}:${slug}`, res);
    incrPatchCost.value += res.costUsd ?? 0;
  }

  for (const sym of inv.newSymbols) {
    const slug = `${slugDir(sym.kind)}/${sym.name}.md`;
    if (pages.has(slug)) continue;
    const symbols = after.symbols.filter((s) => s.file === sym.file && (s.name === sym.name || s.name.startsWith(sym.name + '.')));
    if (symbols.length === 0) continue;
    const res = await generatePage({ slug, symbols, repoRoot: subPath, claudeOpts });
    wrapAndStore(slug, res.content, smap, after, sha.slice(0, 7));
    log_call(`new:${sha.slice(0, 7)}:${slug}`, res);
    incrPatchCost.value += res.costUsd ?? 0;
  }

  if (inv.pagesInvalidated.length || inv.pagesDeleted.length || inv.newSymbols.length) {
    for (const [slug, body] of pageBodies) wrapAndStore(slug, body, smap, after, sha.slice(0, 7));
    regenIndex(smap, after, sha.slice(0, 7));
  }

  console.log(`[step ${step}/${commits.length - 1}] ${sha.slice(0, 7)} touched=${inv.pagesInvalidated.length + inv.pagesDeleted.length + inv.newSymbols.length}  cumulative $${cumulativeCost.toFixed(2)}`);
}

console.log(`[full-rebuild] generating ${Object.keys(smap.pages).length - 1} pages from final state`);
const fullPageBodies = new Map();
const fullPages = new Map();
const fullStartCost = cumulativeCost;
await git.checkout(commits.at(-1));
const finalSnap = buildSnapshot(subPath);
const fullSmap = synthSourcemap(finalSnap);
const finalSha = commits.at(-1).slice(0, 7);
for (const [slug, page] of Object.entries(fullSmap.pages)) {
  if (slug === 'index.md') continue;
  if (page.symbols.length === 0) continue;
  const symbols = finalSnap.symbols.filter((s) => page.symbols.includes(s.id));
  if (symbols.length === 0) continue;
  const res = await generatePage({ slug, symbols, repoRoot: subPath, claudeOpts });
  fullPageBodies.set(slug, res.content);
  const related = computeRelated({ slug, sourcemap: fullSmap, snapshot: finalSnap });
  fullPages.set(slug, assemblePage({
    slug, body: res.content, page: fullSmap.pages[slug],
    sourcemap: fullSmap, snapshot: finalSnap,
    relatedSlugs: related, updated: finalSha,
  }));
  log_call(`full:${slug}`, res);
}
fullPages.set('index.md', buildIndex({ sourcemap: fullSmap, snapshot: finalSnap, pages: fullPages, updated: finalSha }));
const fullRebuildCost = cumulativeCost - fullStartCost;

const sharedSlugs = [...pages.keys()].filter((s) => fullPages.has(s));
const judgeSlugs = sharedSlugs.slice(0, judgeSample);
console.log(`[judge] sampling ${judgeSlugs.length} pages`);
const verdicts = [];
for (const slug of judgeSlugs) {
  const v = await judge({ pageA: pages.get(slug), pageB: fullPages.get(slug), context: `Both pages document slug "${slug}".`, claudeOpts: { model: 'sonnet' } });
  verdicts.push({ slug, score: v.score, equivalent: v.equivalent, differences: v.differences });
  log_call(`judge:${slug}`, v);
  console.log(`  ${slug}  score=${v.score} eq=${v.equivalent}`);
}

for (const [slug, c] of pages) writeFileSync(join(incrDir, slug.replace(/[/]/g, '_')), c);
for (const [slug, c] of fullPages) writeFileSync(join(fullDir, slug.replace(/[/]/g, '_')), c);

const equiv = structuralEquivalence(smap, fullSmap);
const fullProjectedCost = fullRebuildCost * (commits.length - 1);
const realCostRatio = fullProjectedCost > 0 ? incrPatchCost.value / fullProjectedCost : 0;
const avgJudgeScore = verdicts.length ? verdicts.reduce((s, v) => s + v.score, 0) / verdicts.length : null;

const report = {
  app, repoRoot, subdir,
  commits: commits.length,
  pagesBaseline: pages.size,
  pagesFinalIncr: pages.size,
  pagesFinalFull: fullPages.size,
  structural: {
    drift: equiv.drift,
    onlyInIncr: equiv.onlyInA,
    onlyInFull: equiv.onlyInB,
    symbolsDiffer: equiv.symbolsDiffer,
    filesDiffer: equiv.filesDiffer,
  },
  cost: {
    baselineGenUsd: baselineCost,
    incrPatchUsd: incrPatchCost.value,
    fullRebuildOnceUsd: fullRebuildCost,
    fullProjectedAcrossCommitsUsd: fullProjectedCost,
    realCostRatioIncrVsProjFull: realCostRatio,
    totalSpentUsd: cumulativeCost,
  },
  semantic: {
    sampledPages: judgeSlugs.length,
    avgScore: avgJudgeScore,
    verdicts,
  },
  callLog,
};
writeFileSync(reportPath, stableJson(report));

console.log('\n=== LLM DRIFT REPORT ===');
console.log(`app:                    ${app}`);
console.log(`commits:                ${commits.length}`);
console.log(`pages (final incr):     ${pages.size}`);
console.log(`pages (full from-scratch): ${fullPages.size}`);
console.log(`structural drift:       ${(equiv.drift * 100).toFixed(2)}%`);
console.log(``);
console.log(`baseline gen cost:      $${baselineCost.toFixed(2)} (one-time)`);
console.log(`incr patches total:     $${incrPatchCost.value.toFixed(2)}  (across ${commits.length - 1} commits)`);
console.log(`full rebuild ONCE:      $${fullRebuildCost.toFixed(2)}`);
console.log(`full × ${commits.length - 1} commits:    $${fullProjectedCost.toFixed(2)}  (what we'd pay without incr)`);
console.log(`cost ratio incr/full:   ${(realCostRatio * 100).toFixed(2)}%`);
console.log(``);
console.log(`semantic avg score:     ${avgJudgeScore?.toFixed(2) ?? 'n/a'} (across ${judgeSlugs.length} sampled pages)`);
console.log(``);
console.log(`TOTAL SPENT:            $${cumulativeCost.toFixed(2)}`);
console.log(`report:                 ${reportPath}`);

rmSync(tmp, { recursive: true, force: true });

function slugDir(kind) {
  return ({ class: 'entities', interface: 'entities', type: 'types', function: 'logic', enum: 'enums', const: 'consts' }[kind] ?? 'misc');
}
