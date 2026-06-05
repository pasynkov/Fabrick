// fabrick synthesize <out-dir> --repos=<repo1>,<repo2>,... [--system=name]
//
// Cross-repo synthesis. Reads each repo's .fabrick/wiki/ + routing-rules.json,
// bundles them, sends to the LLM with the synthesis skill, writes 4 topic
// pages to <out-dir>.

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callClaude } from '../llm/cli.js';
import { synthesisGeneratePrompt, parseSynthesisOutput, SYNTHESIS_PAGE_SLUGS } from '../llm/synthesis-prompts.js';
import { wikiDir, readRules } from './state.js';
import { stableJson } from '../snapshot/store.js';

const SELF_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const SKILL_PATH = join(SELF_ROOT, 'skills', 'synthesis', 'SKILL.md');

export async function run(outDir, argv = []) {
  if (!outDir) {
    console.error('usage: fabrick synthesize <out-dir> --repos=<r1>,<r2> [--system=name] [--model=sonnet]');
    process.exit(1);
  }
  const repoPaths = (argv.find((a) => a.startsWith('--repos='))?.split('=')[1] ?? '').split(',').filter(Boolean);
  if (repoPaths.length < 2) {
    console.error('--repos must list at least 2 paths');
    process.exit(1);
  }
  const systemName = argv.find((a) => a.startsWith('--system='))?.split('=')[1] ?? basename(outDir);
  const model = argv.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'sonnet';
  const maxCostUsd = Number(argv.find((a) => a.startsWith('--max-cost='))?.split('=')[1] ?? 5);

  const repos = repoPaths.map((p) => loadRepoWikis(p));
  for (const r of repos) console.log(`[load] ${r.repoName}: ${r.scopes.length} scopes`);

  const skill = readFileSync(SKILL_PATH, 'utf8');
  const built = synthesisGeneratePrompt({ system: systemName, repos, skill });

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, '_synthesis.prompt.txt'), `--- system ---\n${built.system}\n\n--- user ---\n${built.user}`);

  console.log(`[synthesize] ${systemName} via ${model}, ${repos.length} repos, ${repos.reduce((s, r) => s + r.scopes.length, 0)} scopes total`);
  const t0 = Date.now();
  const res = await callClaude(built, { model, timeoutMs: 900_000, maxBudgetUsd: maxCostUsd });
  const ms = Date.now() - t0;
  console.log(`[synthesize] ${ms}ms, cost $${(res.costUsd ?? 0).toFixed(4)}`);

  writeFileSync(join(outDir, '_synthesis.response.md'), res.content);

  const pages = parseSynthesisOutput(res.content);
  const missing = SYNTHESIS_PAGE_SLUGS.filter((s) => !pages[s]);
  if (missing.length) console.warn(`[warn] missing pages in response: ${missing.join(', ')}`);

  for (const slug of SYNTHESIS_PAGE_SLUGS) {
    writeFileSync(join(outDir, slug), pages[slug] ?? '(empty)\n');
  }

  writeFileSync(join(outDir, '_meta.json'), stableJson({
    systemName,
    generatedAt: new Date().toISOString(),
    model,
    costUsd: res.costUsd,
    repos: repos.map((r) => ({ repoName: r.repoName, scopes: r.scopes.map((s) => s.name) })),
  }));

  console.log(`[wrote] ${outDir}/  (${SYNTHESIS_PAGE_SLUGS.join(', ')})`);
}

function loadRepoWikis(repoPath) {
  if (!existsSync(repoPath)) throw new Error(`repo not found: ${repoPath}`);
  const wDir = wikiDir(repoPath);
  if (!existsSync(wDir)) throw new Error(`no wiki at ${wDir}; run fabrick fullscan ${repoPath}`);
  const rules = readRules(repoPath) ?? {};
  const repoName = basename(repoPath);
  const scopeDirs = readdirSync(wDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const scopes = [];
  for (const dirName of scopeDirs) {
    const sDir = join(wDir, dirName);
    const pages = {};
    for (const f of ['service.md', 'contracts.md', 'config.md', 'integrations.md']) {
      const p = join(sDir, f);
      if (existsSync(p)) pages[f] = readFileSync(p, 'utf8');
    }
    if (Object.keys(pages).length === 0) continue;
    scopes.push({
      name: dirName.replace(/__/g, '/'),
      root: dirName.replace(/__/g, '/'),
      dirName,
      pages,
    });
  }

  return { repoName, repoPath, project: rules.project ?? null, scopes };
}
