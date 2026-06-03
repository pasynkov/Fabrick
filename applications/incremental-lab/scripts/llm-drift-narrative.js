#!/usr/bin/env node
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { simpleGit } from 'simple-git';
import { buildSnapshot } from '../src/snapshot/snapshot.js';
import { diffSnapshots } from '../src/diff/diff.js';
import { invalidate } from '../src/invalidate/invalidate.js';
import { synthSourcemap, applyInvalidation } from '../src/bench/synth-sourcemap.js';
import { structuralEquivalence } from '../src/validate/validate.js';
import { generatePage, patchPage } from '../src/llm/page-generator.js';
import { generateCommitNarrative } from '../src/llm/narrative.js';
import { validatePatches } from '../src/llm/validator.js';
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
const narratorModel = argv.find((a) => a.startsWith('--narrator='))?.split('=')[1] ?? 'sonnet';
const patcherModel = argv.find((a) => a.startsWith('--patcher='))?.split('=')[1] ?? 'sonnet';
const validatorModel = argv.find((a) => a.startsWith('--validator='))?.split('=')[1] ?? 'haiku';
const baselineModel = argv.find((a) => a.startsWith('--baseline='))?.split('=')[1] ?? 'sonnet';

let repoRoot;
let subdir;
const namiMatch = label.match(/^nami-(.+)$/);
if (explicitRepo) { repoRoot = resolve(explicitRepo); subdir = explicitSubdir ?? '.'; }
else if (namiMatch) {
  const envKey = `NAMI_REPO_${namiMatch[1].toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const envPath = process.env[envKey];
  if (!envPath) { console.error(`Set ${envKey} in .env.local`); process.exit(1); }
  repoRoot = resolve(envPath); subdir = explicitSubdir ?? '.';
} else {
  repoRoot = resolve('../..'); subdir = `applications/${label}`;
}
const app = label;
console.log(`[setup] narrator=${narratorModel} patcher=${patcherModel} validator=${validatorModel} baseline=${baselineModel}`);
console.log(`[source] repo=${repoRoot} subdir=${subdir}`);

const outRoot = join(process.cwd(), '.lab', 'llm-drift-narrative', app);
mkdirSync(join(outRoot, 'incr'), { recursive: true });
mkdirSync(join(outRoot, 'full'), { recursive: true });
mkdirSync(join(outRoot, 'narratives'), { recursive: true });
mkdirSync(join(outRoot, 'validations'), { recursive: true });

const tmp = mkdtempSync(join(tmpdir(), 'llm-narrative-'));
await simpleGit(repoRoot).clone(repoRoot, tmp, ['--no-local']).catch(async () =>
  simpleGit(repoRoot).clone(repoRoot, tmp),
);
const git = simpleGit(tmp);
const subPath = join(tmp, subdir);

const log = await git.log({ maxCount: N + 1, file: subdir });
if (log.all.length < 2) { console.error(`Not enough history`); process.exit(1); }
const commits = log.all.map((c) => c.hash).reverse();
console.log(`[history] ${commits.length} commits`);

let cumulativeCost = 0;
const callLog = [];
const log_call = (label, res) => {
  cumulativeCost += res.costUsd ?? 0;
  callLog.push({ label, cost: res.costUsd, in: res.usage?.input_tokens, out: res.usage?.output_tokens, promptBytes: res.promptBytes });
  if (cumulativeCost > maxCost) throw new Error(`max cost $${maxCost} exceeded (now $${cumulativeCost.toFixed(2)})`);
};

await git.checkout(commits[0]);
let snap = buildSnapshot(subPath);
let smap = synthSourcemap(snap);
console.log(`[baseline] files=${Object.keys(snap.files).length} symbols=${snap.symbols.length} pages=${Object.keys(smap.pages).length - 1}`);

const pageBodies = new Map();
const pages = new Map();
const wrapAndStore = (slug, body, smap, snap, updated) => {
  pageBodies.set(slug, body);
  const related = computeRelated({ slug, sourcemap: smap, snapshot: snap });
  const assembled = assemblePage({ slug, body, page: smap.pages[slug], sourcemap: smap, snapshot: snap, relatedSlugs: related, updated });
  pages.set(slug, assembled);
};

console.log(`[baseline-gen] (${baselineModel})`);
let baselineCost = 0;
let i = 0;
for (const [slug, page] of Object.entries(smap.pages)) {
  i++;
  if (slug === 'index.md') continue;
  if (page.symbols.length === 0) continue;
  const symbols = snap.symbols.filter((s) => page.symbols.includes(s.id));
  process.stdout.write(`  [${i}/${Object.keys(smap.pages).length}] ${slug} ... `);
  const res = await generatePage({ slug, symbols, repoRoot: subPath, claudeOpts: { model: baselineModel } });
  wrapAndStore(slug, res.content, smap, snap, commits[0].slice(0, 7));
  log_call(`gen:${slug}`, res); baselineCost += res.costUsd ?? 0;
  console.log(`$${(res.costUsd ?? 0).toFixed(4)}`);
}
pages.set('index.md', buildIndex({ sourcemap: smap, snapshot: snap, pages, updated: commits[0].slice(0, 7) }));
console.log(`[baseline done] $${baselineCost.toFixed(2)}`);

let incrPatchCost = 0;
let narrativeCost = 0;
let validatorCost = 0;
const validatorReports = [];
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

  let narrative = '';
  let narrativeRes = null;
  if (inv.pagesInvalidated.length + inv.newSymbols.length > 0) {
    narrativeRes = await generateCommitNarrative({ diff, claudeOpts: { model: narratorModel } });
    narrative = narrativeRes.narrative;
    writeFileSync(join(outRoot, 'narratives', `${sha.slice(0, 7)}.md`), narrative + '\n');
    log_call(`narrative:${sha.slice(0, 7)}`, narrativeRes); narrativeCost += narrativeRes.costUsd ?? 0;
  }

  const patchedThisCommit = [];
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
      symbols, repoRoot: subPath,
      beforeSnapshotSymbols: before.symbols, afterSnapshotSymbols: after.symbols,
      claudeOpts: { model: patcherModel },
    });
    wrapAndStore(slug, res.content, smap, after, sha.slice(0, 7));
    patchedThisCommit.push({ slug, body: res.content });
    log_call(`patch:${sha.slice(0, 7)}:${slug}`, res); incrPatchCost += res.costUsd ?? 0;
  }

  for (const sym of inv.newSymbols) {
    const slug = `${slugDir(sym.kind)}/${sym.name}.md`;
    if (pages.has(slug)) continue;
    const symbols = after.symbols.filter((s) => s.file === sym.file && (s.name === sym.name || s.name.startsWith(sym.name + '.')));
    if (symbols.length === 0) continue;
    const res = await generatePage({ slug, symbols, repoRoot: subPath, claudeOpts: { model: patcherModel } });
    wrapAndStore(slug, res.content, smap, after, sha.slice(0, 7));
    patchedThisCommit.push({ slug, body: res.content });
    log_call(`new:${sha.slice(0, 7)}:${slug}`, res); incrPatchCost += res.costUsd ?? 0;
  }

  if (narrative && patchedThisCommit.length > 0) {
    const v = await validatePatches({ narrative, pages: patchedThisCommit, claudeOpts: { model: validatorModel } });
    validatorReports.push({ sha: sha.slice(0, 7), score: v.score, landed: v.landed, missing: v.missing });
    writeFileSync(join(outRoot, 'validations', `${sha.slice(0, 7)}.json`), JSON.stringify({ sha, narrative, validation: v }, null, 2));
    log_call(`validate:${sha.slice(0, 7)}`, v); validatorCost += v.costUsd ?? 0;
  }

  if (inv.pagesInvalidated.length || inv.pagesDeleted.length || inv.newSymbols.length) {
    for (const [s, b] of pageBodies) wrapAndStore(s, b, smap, after, sha.slice(0, 7));
    pages.set('index.md', buildIndex({ sourcemap: smap, snapshot: snap, pages, updated: sha.slice(0, 7) }));
  }

  const lastVal = validatorReports[validatorReports.length - 1];
  const valStr = lastVal ? `val=${lastVal.score ?? 'n/a'}` : '';
  console.log(`[step ${step}/${commits.length - 1}] ${sha.slice(0, 7)} touched=${inv.pagesInvalidated.length + inv.pagesDeleted.length + inv.newSymbols.length} narr=$${(narrativeRes?.costUsd ?? 0).toFixed(4)} ${valStr} cumul=$${cumulativeCost.toFixed(2)}`);
}

console.log(`[full-rebuild] (${baselineModel})`);
const fullStartCost = cumulativeCost;
await git.checkout(commits.at(-1));
const finalSnap = buildSnapshot(subPath);
const fullSmap = synthSourcemap(finalSnap);
const finalSha = commits.at(-1).slice(0, 7);
const fullPages = new Map();
for (const [slug, page] of Object.entries(fullSmap.pages)) {
  if (slug === 'index.md') continue;
  if (page.symbols.length === 0) continue;
  const symbols = finalSnap.symbols.filter((s) => page.symbols.includes(s.id));
  if (symbols.length === 0) continue;
  const res = await generatePage({ slug, symbols, repoRoot: subPath, claudeOpts: { model: baselineModel } });
  const related = computeRelated({ slug, sourcemap: fullSmap, snapshot: finalSnap });
  fullPages.set(slug, assemblePage({ slug, body: res.content, page: fullSmap.pages[slug], sourcemap: fullSmap, snapshot: finalSnap, relatedSlugs: related, updated: finalSha }));
  log_call(`full:${slug}`, res);
}
fullPages.set('index.md', buildIndex({ sourcemap: fullSmap, snapshot: finalSnap, pages: fullPages, updated: finalSha }));
const fullRebuildCost = cumulativeCost - fullStartCost;

const sharedSlugs = [...pages.keys()].filter((s) => fullPages.has(s));
const judgeSlugs = sharedSlugs.slice(0, judgeSample);
const verdicts = [];
console.log(`[judge] sampling ${judgeSlugs.length} pages`);
for (const slug of judgeSlugs) {
  const v = await judge({ pageA: pages.get(slug), pageB: fullPages.get(slug), context: `Both pages document slug "${slug}".`, claudeOpts: { model: 'sonnet' } });
  verdicts.push({ slug, score: v.score, equivalent: v.equivalent, differences: v.differences });
  log_call(`judge:${slug}`, v);
  console.log(`  ${slug} score=${v.score} eq=${v.equivalent}`);
}

for (const [slug, c] of pages) writeFileSync(join(outRoot, 'incr', slug.replace(/[/]/g, '_')), c);
for (const [slug, c] of fullPages) writeFileSync(join(outRoot, 'full', slug.replace(/[/]/g, '_')), c);

const equiv = structuralEquivalence(smap, fullSmap);
const fullProjectedCost = fullRebuildCost * (commits.length - 1);
const realCostRatio = fullProjectedCost > 0 ? (incrPatchCost + narrativeCost) / fullProjectedCost : 0;
const avgScore = verdicts.length ? verdicts.reduce((s, v) => s + v.score, 0) / verdicts.length : null;

const avgValidatorScore = validatorReports.length
  ? validatorReports.reduce((s, r) => s + (r.score ?? 0), 0) / validatorReports.filter((r) => r.score != null).length
  : null;

const report = {
  app, narratorModel, patcherModel, validatorModel, baselineModel,
  commits: commits.length,
  pagesFinalIncr: pages.size, pagesFinalFull: fullPages.size,
  structural: { drift: equiv.drift, ...equiv },
  cost: {
    baselineGenUsd: baselineCost,
    narrativeUsd: narrativeCost,
    incrPatchUsd: incrPatchCost,
    validatorUsd: validatorCost,
    fullRebuildOnceUsd: fullRebuildCost,
    fullProjectedAcrossCommitsUsd: fullProjectedCost,
    realCostRatioIncrVsProjFull: realCostRatio,
    totalSpentUsd: cumulativeCost,
  },
  semantic: { sampledPages: judgeSlugs.length, avgScore, verdicts },
  validation: { avgScore: avgValidatorScore, reports: validatorReports },
  callLog,
};
writeFileSync(join(outRoot, 'report.json'), stableJson(report));

console.log(`\n=== NARRATIVE+VALIDATOR DRIFT REPORT ===`);
console.log(`agents: narrator=${narratorModel} patcher=${patcherModel} validator=${validatorModel} baseline=${baselineModel}`);
console.log(`structural drift:    ${(equiv.drift * 100).toFixed(2)}%`);
console.log(`baseline:            $${baselineCost.toFixed(2)}`);
console.log(`narratives:          $${narrativeCost.toFixed(2)}`);
console.log(`incr patches:        $${incrPatchCost.toFixed(2)}`);
console.log(`validators:          $${validatorCost.toFixed(2)}`);
console.log(`full × ${commits.length - 1}:          $${fullProjectedCost.toFixed(2)}`);
console.log(`cost ratio:          ${(realCostRatio * 100).toFixed(2)}%`);
console.log(`semantic avg score (judge):    ${avgScore?.toFixed(2) ?? 'n/a'}`);
console.log(`narrative coverage (validator): ${avgValidatorScore?.toFixed(2) ?? 'n/a'}`);
console.log(`TOTAL SPENT:         $${cumulativeCost.toFixed(2)}`);
console.log(`report:              ${join(outRoot, 'report.json')}`);

rmSync(tmp, { recursive: true, force: true });

function slugDir(kind) { return ({ class: 'entities', interface: 'entities', type: 'types', function: 'logic', enum: 'enums', const: 'consts' }[kind] ?? 'misc'); }
