// fabrick synthesize <out-dir> --repos=<repo1>,<repo2>,... [--system=name]
//
// Cross-repo synthesis. Auto-detects mode:
//   GENESIS — no existing _baseline-wiki/ snapshot → full single-call generation
//   PATCH   — baseline exists → diff each repo's wiki vs baseline, compute +
//             apply per-topic patch instructions, refresh baseline
// Use --rebuild to force GENESIS.

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callClaude } from '../llm/cli.js';
import {
  synthesisGeneratePrompt, parseSynthesisOutput, SYNTHESIS_PAGE_SLUGS,
  computeSynthesisPatchPrompt, computeSynthesisPatchPerTopicPrompt, applySynthesisPatchPrompt,
} from '../llm/synthesis-prompts.js';
import { pMap } from '../util/concurrent.js';
import { wikiDir, readRules } from './state.js';
import { stableJson } from '../snapshot/store.js';
import { stampFrontmatter, stripFrontmatter, firstSentence as fmFirstSentence } from '../wiki/frontmatter.js';
import { buildSynthLinkRewriter } from '../wiki/synthesis-link-rewrite.js';
import { extractMarkdownSymbols, diffMarkdownSymbols, renderMarkdownDiff } from '../extract/markdown.js';

const TOPIC_TITLE = {
  'system.md':          'System Overview',
  'data-flows.md':      'Data Flows',
  'transport-graph.md': 'Transport Graph',
  'infra.md':           'Infrastructure',
};

function writeTopic(outDir, slug, body, ctx) {
  let finalBody = body;
  if (ctx.linkRewriter) {
    const res = ctx.linkRewriter(body);
    finalBody = res.body;
    if (res.rewrites || res.unresolved) {
      console.log(`  [${slug}] link rewrite: ${res.rewrites} fixed, ${res.unresolved} unresolved`);
    }
  }
  const fm = {
    name: `${ctx.systemName} — ${TOPIC_TITLE[slug] ?? slug}`,
    description: fmFirstSentence(finalBody),
    type: 'synthesis',
    system: ctx.systemName,
    slug,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(join(outDir, slug), stampFrontmatter(fm, finalBody));
}

const SELF_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const SKILL_PATH = join(SELF_ROOT, 'skills', 'synthesis', 'SKILL.md');

export async function run(outDir, argv = []) {
  if (!outDir) {
    console.error('usage: fabrick synthesize <out-dir> --repos=<r1>,<r2> [--system=name] [--rebuild] [--model=sonnet]');
    process.exit(1);
  }
  const repoPaths = (argv.find((a) => a.startsWith('--repos='))?.split('=')[1] ?? '').split(',').filter(Boolean);
  if (repoPaths.length < 2) {
    console.error('--repos must list at least 2 paths');
    process.exit(1);
  }
  const systemName = argv.find((a) => a.startsWith('--system='))?.split('=')[1] ?? basename(outDir);
  const computeModel = argv.find((a) => a.startsWith('--compute-model='))?.split('=')[1] ?? argv.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'sonnet';
  const applyModel = argv.find((a) => a.startsWith('--apply-model='))?.split('=')[1] ?? 'haiku';
  const maxCostUsd = Number(argv.find((a) => a.startsWith('--max-cost='))?.split('=')[1] ?? 5);
  const rebuild = argv.includes('--rebuild');
  const perTopic = argv.includes('--per-topic');

  const repos = repoPaths.map((p) => loadRepoWikis(p));
  for (const r of repos) console.log(`[load] ${r.repoName}: ${r.scopes.length} scopes`);

  mkdirSync(outDir, { recursive: true });
  const baselineDir = join(outDir, '_baseline-wiki');

  if (rebuild || !existsSync(baselineDir)) {
    await runGenesis({ outDir, baselineDir, systemName, repos, computeModel, maxCostUsd });
  } else {
    await runPatch({ outDir, baselineDir, systemName, repos, computeModel, applyModel, maxCostUsd, perTopic });
  }
}

async function runGenesis({ outDir, baselineDir, systemName, repos, computeModel, maxCostUsd }) {
  const skill = readFileSync(SKILL_PATH, 'utf8');
  const built = synthesisGeneratePrompt({ system: systemName, repos, skill });
  writeFileSync(join(outDir, '_synthesis.prompt.txt'), `--- system ---\n${built.system}\n\n--- user ---\n${built.user}`);

  console.log(`[genesis] ${systemName} via ${computeModel}, ${repos.length} repos, ${repos.reduce((s, r) => s + r.scopes.length, 0)} scopes`);
  const t0 = Date.now();
  const res = await callClaude(built, { model: computeModel, timeoutMs: 900_000, maxBudgetUsd: maxCostUsd });
  const ms = Date.now() - t0;
  console.log(`[genesis] ${ms}ms, cost $${(res.costUsd ?? 0).toFixed(4)}`);

  writeFileSync(join(outDir, '_synthesis.response.md'), res.content);
  const pages = parseSynthesisOutput(res.content);
  const linkRewriter = buildSynthLinkRewriter(repos);
  for (const slug of SYNTHESIS_PAGE_SLUGS) {
    writeTopic(outDir, slug, pages[slug] ?? '(empty)\n', { systemName, linkRewriter });
  }

  // Snapshot current wikis as the patch baseline.
  rmSync(baselineDir, { recursive: true, force: true });
  mkdirSync(baselineDir, { recursive: true });
  for (const repo of repos) {
    const dst = join(baselineDir, repo.repoName);
    cpSync(wikiDir(repo.repoPath), dst, { recursive: true });
  }

  writeFileSync(join(outDir, '_meta.json'), stableJson({
    systemName,
    generatedAt: new Date().toISOString(),
    mode: 'genesis',
    computeModel,
    costUsd: res.costUsd,
    repos: repos.map((r) => ({ repoName: r.repoName, scopes: r.scopes.map((s) => s.name) })),
  }));

  console.log(`[wrote] ${outDir}/  + baseline at _baseline-wiki/`);
}

async function runPatch({ outDir, baselineDir, systemName, repos, computeModel, applyModel, maxCostUsd, perTopic = false }) {
  const existingPages = {};
  for (const slug of SYNTHESIS_PAGE_SLUGS) {
    if (existsSync(join(outDir, slug))) {
      existingPages[slug] = stripFrontmatter(readFileSync(join(outDir, slug), 'utf8')).content;
    } else {
      existingPages[slug] = '';
    }
  }

  // Detect changes between baseline-wiki and current wikis.
  const changed = [];
  for (const repo of repos) {
    const baseRepoDir = join(baselineDir, repo.repoName);
    if (!existsSync(baseRepoDir)) {
      console.warn(`[patch] no baseline for ${repo.repoName} — treating all scopes as new`);
    }
    for (const scope of repo.scopes) {
      for (const [slug, body] of Object.entries(scope.pages)) {
        const basePath = join(baseRepoDir, scope.dirName, slug);
        const baseBody = existsSync(basePath) ? stripFrontmatter(readFileSync(basePath, 'utf8')).content : null;
        if (baseBody === body) continue;

        // Filter out churn-only changes: if no semantic markdown symbols moved
        // (just frontmatter/timestamp shuffle), skip. When symbols DID move,
        // still pass FULL before+after bodies — synthesis quality drops
        // sharply when the compute LLM doesn't see the unchanged context.
        const symsBefore = baseBody == null ? [] : extractMarkdownSymbols(slug, baseBody);
        const symsAfter = extractMarkdownSymbols(slug, body);
        const mdDiff = diffMarkdownSymbols(symsBefore, symsAfter);
        if (mdDiff.added.length + mdDiff.deleted.length + mdDiff.changed.length === 0) continue;
        changed.push({
          repoName: repo.repoName,
          scopeName: scope.name,
          dirName: scope.dirName,
          slug,
          before: baseBody,
          after: body,
          symbolCounts: { added: mdDiff.added.length, deleted: mdDiff.deleted.length, changed: mdDiff.changed.length },
          changeKind: baseBody == null ? 'added' : 'modified',
        });
      }
      if (existsSync(join(baseRepoDir, scope.dirName))) {
        const baseSlugs = readdirSync(join(baseRepoDir, scope.dirName)).filter((f) => f.endsWith('.md'));
        for (const slug of baseSlugs) {
          if (!scope.pages[slug]) {
            changed.push({
              repoName: repo.repoName,
              scopeName: scope.name,
              dirName: scope.dirName,
              slug,
              before: stripFrontmatter(readFileSync(join(baseRepoDir, scope.dirName, slug), 'utf8')).content,
              after: null,
              changeKind: 'deleted',
            });
          }
        }
      }
    }
  }

  console.log(`[patch] ${changed.length} wiki pages changed`);
  if (changed.length === 0) {
    console.log('[patch] nothing to do');
    return;
  }

  // Compute patch — single-call (default) OR per-topic parallel (4 calls)
  let patchBySlug = {};
  let computeCost = 0;
  const t1 = Date.now();
  if (perTopic) {
    console.log('[compute] per-topic mode: 4 parallel calls');
    const results = {};
    await pMap(SYNTHESIS_PAGE_SLUGS, async (slug) => {
      const built = computeSynthesisPatchPerTopicPrompt({ system: systemName, topic: slug, existingPages, changedWikiPages: changed });
      writeFileSync(join(outDir, `_compute.${slug}.prompt.txt`), `--- system ---\n${built.system}\n\n--- user ---\n${built.user}`);
      const res = await callClaude(built, { model: computeModel, timeoutMs: 900_000, maxBudgetUsd: maxCostUsd });
      writeFileSync(join(outDir, `_compute.${slug}.response.md`), res.content);
      computeCost += res.costUsd ?? 0;
      const parsed = parseSynthesisPatch(res.content);
      results[slug] = parsed[slug] ?? '';
      console.log(`  ${slug}: $${(res.costUsd ?? 0).toFixed(4)}`);
    }, { concurrency: 4 });
    patchBySlug = results;
  } else {
    const computeBuilt = computeSynthesisPatchPrompt({ system: systemName, existingPages, changedWikiPages: changed });
    writeFileSync(join(outDir, '_compute.prompt.txt'), `--- system ---\n${computeBuilt.system}\n\n--- user ---\n${computeBuilt.user}`);
    const compRes = await callClaude(computeBuilt, { model: computeModel, timeoutMs: 900_000, maxBudgetUsd: maxCostUsd });
    computeCost = compRes.costUsd ?? 0;
    writeFileSync(join(outDir, '_compute.response.md'), compRes.content);
    patchBySlug = parseSynthesisPatch(compRes.content);
  }
  console.log(`[compute] total ${Date.now() - t1}ms cost $${computeCost.toFixed(4)}`);
  writeFileSync(join(outDir, '_patch.md'),
    SYNTHESIS_PAGE_SLUGS.map((slug) => `=== PATCH: ${slug} ===\n${patchBySlug[slug] ?? 'no changes'}`).join('\n\n') + '\n');

  const slugsToApply = SYNTHESIS_PAGE_SLUGS.filter((slug) => !isNoChanges(patchBySlug[slug]));
  let applyCost = 0;
  if (slugsToApply.length === 0) {
    console.log('[patch] all topics no-op; refreshing baseline only');
  } else {
    console.log(`[apply] ${slugsToApply.length} topics need updates: ${slugsToApply.join(', ')}`);
    const applyBuilt = applySynthesisPatchPrompt({ system: systemName, existingPages, patchBySlug, slugsToApply });
    writeFileSync(join(outDir, '_apply.prompt.txt'), `--- system ---\n${applyBuilt.system}\n\n--- user ---\n${applyBuilt.user}`);
    const t2 = Date.now();
    const apRes = await callClaude(applyBuilt, { model: applyModel, timeoutMs: 900_000, maxBudgetUsd: maxCostUsd });
    applyCost = apRes.costUsd ?? 0;
    console.log(`[apply]   ${Date.now() - t2}ms cost $${applyCost.toFixed(4)}`);
    writeFileSync(join(outDir, '_apply.response.md'), apRes.content);

    const newPages = parseSynthesisOutput(apRes.content);
    const linkRewriter = buildSynthLinkRewriter(repos);
    for (const slug of slugsToApply) {
      if (newPages[slug]) writeTopic(outDir, slug, newPages[slug], { systemName, linkRewriter });
    }
  }

  // Refresh baseline.
  rmSync(baselineDir, { recursive: true, force: true });
  mkdirSync(baselineDir, { recursive: true });
  for (const repo of repos) cpSync(wikiDir(repo.repoPath), join(baselineDir, repo.repoName), { recursive: true });

  const totalCost = computeCost + applyCost;
  writeFileSync(join(outDir, '_meta.json'), stableJson({
    systemName,
    generatedAt: new Date().toISOString(),
    mode: 'patch',
    computeModel,
    applyModel,
    changedCount: changed.length,
    appliedSlugs: slugsToApply,
    costUsd: totalCost,
    repos: repos.map((r) => ({ repoName: r.repoName, scopes: r.scopes.map((s) => s.name) })),
  }));

  console.log(`[wrote] ${outDir}/  + refreshed baseline`);
}

function parseSynthesisPatch(raw) {
  const out = {};
  if (!raw) return out;
  const re = /===\s*PATCH:\s*([^\s=]+)\s*===\s*\n?/g;
  const positions = [];
  let m;
  while ((m = re.exec(raw)) !== null) positions.push({ slug: m[1], contentStart: re.lastIndex, headerStart: m.index });
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    const next = positions[i + 1];
    out[p.slug] = raw.slice(p.contentStart, next ? next.headerStart : raw.length).trim();
  }
  return out;
}

function isNoChanges(s) {
  return !s || /^no\s+changes\.?$/i.test(s.trim());
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
      if (existsSync(p)) pages[f] = stripFrontmatter(readFileSync(p, 'utf8')).content;
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
