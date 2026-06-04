#!/usr/bin/env node
// Replay a single arch patch with current (possibly updated) prompts and
// judge it against the saved ground-truth full-rebuild page.

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { patchArchPage } from '../src/synthesis/page-generator.js';
import { judge } from '../src/llm/judge.js';

const argv = process.argv.slice(2);
const iter = Number(argv.find((a) => a.startsWith('--iter='))?.split('=')[1] ?? 5);
const slug = argv.find((a) => a.startsWith('--slug='))?.split('=')[1] ?? 'entities/harvest.md';
const WIKI_ROOT = '.lab/wiki-drift';
const SYNTH_ROOT = '.lab/synthesis-drift';
const safeSlug = slug.replace(/[/]/g, '_').replace(/\.md$/, '');

const taxonomy = JSON.parse(readFileSync(join(SYNTH_ROOT, 'iter-0/synthesis-incremental/taxonomy.json'), 'utf8'));
const page = taxonomy.pages.find((p) => p.archSlug === slug);
if (!page) { console.error(`page ${slug} not in taxonomy`); process.exit(1); }

const existingDir = join(SYNTH_ROOT, `iter-${iter}/synthesis-incremental/patches`, safeSlug);
const existingBody = readFileSync(join(existingDir, 'existing-body.md'), 'utf8');
const wikiPatchSummary = readFileSync(join(existingDir, 'wiki-patch-summary.txt'), 'utf8');

const wikiExcerpts = page.wikiRefs.map(({ repo, slug }) => {
  const body = readFileSync(join(WIKI_ROOT, `iter-${iter}`, repo, 'wiki-incremental/after', slug.replace(/[/]/g, '_')), 'utf8').slice(0, 4000);
  return { repo, slug, body };
}).filter((x) => x.body);

console.log(`[setup] page=${slug}  iter=${iter}  refs=${wikiExcerpts.length}`);

const res = await patchArchPage({ page, existingPage: existingBody, wikiExcerpts, wikiPatchSummary, claudeOpts: { model: 'sonnet' } });
const outDir = join(SYNTH_ROOT, `iter-${iter}/retry-${safeSlug}`);
const fs = await import('node:fs');
fs.mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'prompt.txt'), res.prompt);
writeFileSync(join(outDir, 'llm-response.md'), res.rawResponse);
writeFileSync(join(outDir, 'incremental.md'), res.content);
console.log(`[patch] cost=$${res.costUsd.toFixed(3)}  out=${res.content.length} chars`);

const fullBody = readFileSync(join(SYNTH_ROOT, `iter-${iter}/synthesis-fullrebuild/pages`, slug.replace(/[/]/g, '_')), 'utf8');
const v = await judge({ pageA: res.content, pageB: fullBody, context: `Both pages document project wiki slug "${slug}".`, claudeOpts: { model: 'sonnet' } });
writeFileSync(join(outDir, 'verdict.json'), JSON.stringify(v, null, 2));
console.log(`[judge] score=${v.score} equivalent=${v.equivalent}`);
console.log('differences:');
for (const d of v.differences ?? []) console.log('  -', d);
console.log(`[saved] ${outDir}`);
