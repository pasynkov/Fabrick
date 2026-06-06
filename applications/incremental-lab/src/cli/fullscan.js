// fabrick fullscan <repo>
//
// Generate the initial wiki for every app scope in the repo. One LLM call
// per scope produces all 4 pages. Writes to <repo>/.fabrick/wiki/<scope>/.
// Updates state.json baselineSha to the current HEAD.

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { detectScopes } from '../scope/monorepo.js';
import { buildSnapshot } from '../snapshot/snapshot.js';
import { generateAppScope } from '../wiki/app-page-generator.js';
import { APP_PAGE_SLUGS, APP_PAGES } from '../wiki/app-taxonomy.js';
import { buildRepoIndex, buildScopeIndex } from '../wiki/monorepo-index.js';
import { pMap } from '../util/concurrent.js';
import { fabrickDir, readRules, readState, writeState, wikiDir } from './state.js';
import { stampFrontmatter, firstSentence as fmFirstSentence } from '../wiki/frontmatter.js';

export async function run(repoPath, argv = []) {
  if (!repoPath || !existsSync(repoPath)) {
    console.error('usage: fabrick fullscan <repo-path> [--model=sonnet] [--concurrency=4]');
    process.exit(1);
  }
  const model = argv.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'sonnet';
  const concurrency = Number(argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? 4);
  const maxCostUsd = Number(argv.find((a) => a.startsWith('--max-cost='))?.split('=')[1] ?? 20);

  const rules = readRules(repoPath);
  if (!rules) {
    console.error('no routing-rules.json; run: fabrick bootstrap <repo> first');
    process.exit(1);
  }

  const state = readState(repoPath) ?? { version: 1, scopes: {} };
  const scopes = detectScopes(repoPath).filter((s) => s.kind === 'app');
  console.log(`[fullscan] ${scopes.length} app scopes`);

  const wDir = wikiDir(repoPath);
  mkdirSync(wDir, { recursive: true });

  const repoName = rules.project?.repoName ?? repoPath.split('/').pop();
  const git = simpleGit(repoPath);
  const sha = (await git.revparse(['HEAD'])).trim();
  console.log(`[fullscan] HEAD ${sha.slice(0, 7)}`);

  let totalCost = 0;
  const accrue = (res) => {
    totalCost += res.costUsd ?? 0;
    if (totalCost > maxCostUsd) throw new Error(`max-cost $${maxCostUsd} exceeded ($${totalCost.toFixed(2)})`);
  };

  const claudeOpts = { model, timeoutMs: 600_000 };
  const perScopeDescriptions = {};

  await pMap(scopes, async (scope) => {
    const scopePath = join(repoPath, scope.root);
    const snap = buildSnapshot(scopePath);
    const fileList = Object.keys(snap.files).sort();
    if (fileList.length === 0) {
      console.log(`  ${scope.name}: empty-scope`);
      return;
    }
    const res = await generateAppScope({
      scopePath, scopeName: scope.name, scopeKind: scope.kind, repoName,
      sourceFiles: fileList, claudeOpts,
    });
    accrue(res);

    const scopeOut = join(wDir, scope.root.replace(/\//g, '__'));
    mkdirSync(scopeOut, { recursive: true });
    for (const slug of APP_PAGE_SLUGS) {
      const body = res.pages[slug] ?? '(empty)\n';
      const def = APP_PAGES.find((p) => p.slug === slug);
      const fm = {
        name: `${scope.name} — ${def?.title ?? slug}`,
        description: fmFirstSentence(body),
        type: 'wiki',
        repo: repoName,
        scope: scope.name,
        slug,
        sha,
        updatedAt: new Date().toISOString(),
      };
      writeFileSync(join(scopeOut, slug), stampFrontmatter(fm, body));
    }
    writeFileSync(join(scopeOut, 'index.md'), buildScopeIndex({ scope, pages: res.pages, sha }));

    perScopeDescriptions[scope.root] = fmFirstSentence(res.pages['service.md'] ?? '');
    state.scopes[scope.root] = { name: scope.name, kind: scope.kind, lastPatchedSha: sha };
    console.log(`  ${scope.name}: $${(res.costUsd ?? 0).toFixed(3)} (${fileList.length} files)`);
  }, { concurrency });

  writeFileSync(join(wDir, 'index.md'),
    buildRepoIndex({ repoName, scopes, sha, perScopeDescriptions }));

  state.baselineSha = sha;
  state.lastFullscanAt = new Date().toISOString();
  state.lastFullscanCostUsd = totalCost;
  writeState(repoPath, state);

  console.log('');
  console.log(`[fullscan] total cost $${totalCost.toFixed(2)}`);
  console.log(`[wrote]   ${wDir}/`);
  console.log('next: fabrick patch <repo>   (after upstream commits)');
}

