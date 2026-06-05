// fabrick patch <repo>
//
// For each app scope, diff baseline SHA to HEAD. If changed, compute the
// patch (sonnet) and apply it (haiku). Update wiki files in place and
// advance baselineSha.

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { detectScopes } from '../scope/monorepo.js';
import { APP_PAGE_SLUGS } from '../wiki/app-taxonomy.js';
import { computePatch, applyPatch } from '../wiki/patch.js';
import { buildScopeIndex, buildRepoIndex } from '../wiki/monorepo-index.js';
import { pMap } from '../util/concurrent.js';
import { readState, writeState, readRules, wikiDir } from './state.js';

const DIFF_CAP = 50_000;

export async function run(repoPath, argv = []) {
  if (!repoPath || !existsSync(repoPath)) {
    console.error('usage: fabrick patch <repo-path> [--compute-model=sonnet] [--apply-model=haiku]');
    process.exit(1);
  }
  const computeModel = argv.find((a) => a.startsWith('--compute-model='))?.split('=')[1] ?? 'sonnet';
  const applyModel = argv.find((a) => a.startsWith('--apply-model='))?.split('=')[1] ?? 'haiku';
  const concurrency = Number(argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? 4);
  const maxCostUsd = Number(argv.find((a) => a.startsWith('--max-cost='))?.split('=')[1] ?? 10);

  const state = readState(repoPath);
  if (!state?.baselineSha) {
    console.error('no baseline; run: fabrick fullscan <repo> first');
    process.exit(1);
  }
  const rules = readRules(repoPath);
  if (!rules) { console.error('no routing rules'); process.exit(1); }

  const git = simpleGit(repoPath);
  const headSha = (await git.revparse(['HEAD'])).trim();
  if (headSha === state.baselineSha) {
    console.log(`[patch] HEAD == baseline (${headSha.slice(0, 7)}); nothing to do`);
    return;
  }
  console.log(`[patch] ${state.baselineSha.slice(0, 7)}..${headSha.slice(0, 7)}`);

  const repoName = rules.project?.repoName ?? repoPath.split('/').pop();
  const scopes = detectScopes(repoPath).filter((s) => s.kind === 'app');
  const wDir = wikiDir(repoPath);

  let totalCompute = 0;
  let totalApply = 0;
  const accrue = (res, bucket) => {
    if (bucket === 'compute') totalCompute += res.costUsd ?? 0;
    else totalApply += res.costUsd ?? 0;
    if (totalCompute + totalApply > maxCostUsd) throw new Error(`max-cost $${maxCostUsd} exceeded`);
  };

  const computeOpts = { model: computeModel, timeoutMs: 600_000 };
  const applyOpts = { model: applyModel, timeoutMs: 600_000 };
  const perScopeDescriptions = {};

  await pMap(scopes, async (scope) => {
    const scopeOut = join(wDir, scope.root.replace(/\//g, '__'));
    if (!existsSync(scopeOut)) {
      console.log(`  ${scope.name}: SKIP (no baseline wiki — run fullscan)`);
      return;
    }

    const fromSha = state.scopes[scope.root]?.lastPatchedSha ?? state.baselineSha;
    const unifiedDiff = await readDiff(git, fromSha, headSha, scope.root);
    if (!unifiedDiff.trim()) {
      // no source change in scope between baseline and HEAD
      state.scopes[scope.root] = { ...state.scopes[scope.root], name: scope.name, kind: scope.kind, lastPatchedSha: headSha };
      return;
    }

    const existingPages = readExistingPages(scopeOut);

    const comp = await computePatch({
      scopeName: scope.name, scopeKind: scope.kind, repoName,
      existingPages, unifiedDiff, claudeOpts: computeOpts,
    });
    accrue(comp, 'compute');
    writeFileSync(join(scopeOut, '_patch.md'), comp.patch);

    if (comp.allNoOp) {
      console.log(`  ${scope.name}: compute=$${(comp.costUsd ?? 0).toFixed(3)} → no changes`);
      state.scopes[scope.root] = { ...state.scopes[scope.root], name: scope.name, kind: scope.kind, lastPatchedSha: headSha };
      return;
    }

    const ap = await applyPatch({
      scopeName: scope.name, scopeKind: scope.kind, repoName,
      existingPages, patchBySlug: comp.patchBySlug, claudeOpts: applyOpts,
    });
    accrue(ap, 'apply');

    for (const slug of APP_PAGE_SLUGS) if (ap.pages[slug]) existingPages[slug] = ap.pages[slug];
    for (const slug of APP_PAGE_SLUGS) writeFileSync(join(scopeOut, slug), existingPages[slug] ?? '(empty)\n');
    writeFileSync(join(scopeOut, 'index.md'), buildScopeIndex({ scope, pages: existingPages, sha: headSha }));

    state.scopes[scope.root] = { ...state.scopes[scope.root], name: scope.name, kind: scope.kind, lastPatchedSha: headSha };
    perScopeDescriptions[scope.root] = firstSentence(existingPages['service.md'] ?? '');
    console.log(`  ${scope.name}: compute=$${(comp.costUsd ?? 0).toFixed(3)} apply=$${(ap.costUsd ?? 0).toFixed(3)}`);
  }, { concurrency });

  // Refresh top-level index if any scope was patched (carry over old descriptions for unchanged)
  for (const scope of scopes) {
    if (!perScopeDescriptions[scope.root]) {
      const p = join(wDir, scope.root.replace(/\//g, '__'), 'service.md');
      if (existsSync(p)) perScopeDescriptions[scope.root] = firstSentence(readFileSync(p, 'utf8'));
    }
  }
  writeFileSync(join(wDir, 'index.md'),
    buildRepoIndex({ repoName, scopes, sha: headSha, perScopeDescriptions }));

  state.baselineSha = headSha;
  state.lastPatchAt = new Date().toISOString();
  state.lastPatchCostUsd = totalCompute + totalApply;
  writeState(repoPath, state);

  console.log('');
  console.log(`[patch] compute=$${totalCompute.toFixed(2)} apply=$${totalApply.toFixed(2)} total=$${(totalCompute + totalApply).toFixed(2)}`);
}

async function readDiff(git, before, after, scopeRoot) {
  try {
    const out = await git.diff([`${before}..${after}`, '--unified=2', '--', scopeRoot]);
    if (out.length > DIFF_CAP) return out.slice(0, DIFF_CAP) + '\n... (truncated)';
    return out;
  } catch { return ''; }
}

function readExistingPages(scopeOut) {
  const out = {};
  for (const slug of APP_PAGE_SLUGS) {
    const p = join(scopeOut, slug);
    if (existsSync(p)) out[slug] = readFileSync(p, 'utf8');
  }
  return out;
}

function firstSentence(body) {
  if (!body) return '';
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('-') || t.startsWith('*') || t.startsWith('**')) continue;
    const m = t.match(/^[^.!?]{20,160}[.!?]/);
    if (m) return m[0];
    return t.length > 140 ? t.slice(0, 137) + '...' : t;
  }
  return '';
}
