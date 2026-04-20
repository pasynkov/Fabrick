#!/usr/bin/env node
/**
 * loop.js — orchestrator: run → eval → improve → repeat
 *
 * Usage:
 *   node scripts/loop.js [--corpus corpus.yaml] [--batch-size 5] [--max-iterations 10]
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { program } from 'commander';
import yaml from 'js-yaml';
import { runCorpus, generateRunId } from './run.js';
import { evaluateRun } from './evaluate.js';
import { improve } from './improve.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOOP_ROOT = join(__dirname, '..');
const BENCHMARKS_DIR = join(LOOP_ROOT, 'benchmarks');

const PLATEAU_THRESHOLD = 0.02; // <2% improvement = plateau

program
  .option('--corpus <path>', 'Path to corpus.yaml', join(LOOP_ROOT, 'corpus.yaml'))
  .option('--batch-size <n>', 'Repos per iteration batch', '5')
  .option('--max-iterations <n>', 'Max iterations before forced stop', '20')
  .parse();

const opts = program.opts();
const BATCH_SIZE = parseInt(opts.batchSize, 10);
const MAX_ITERATIONS = parseInt(opts.maxIterations, 10);

async function main() {
  const corpus = yaml.load(readFileSync(opts.corpus, 'utf8'));
  const allUrls = (corpus.repos || []).map(r => r.url);

  if (allUrls.length === 0) {
    console.error('corpus.yaml has no repos. Add repos first (see corpus.yaml).');
    process.exit(1);
  }

  console.log(`Loop starting: ${allUrls.length} repos, batch-size ${BATCH_SIZE}, max ${MAX_ITERATIONS} iterations`);

  const allRunIds = [];
  let prevOverall = null;
  let iteration = 0;

  // Process corpus in batches
  for (let batchStart = 0; batchStart < allUrls.length; batchStart += BATCH_SIZE) {
    if (iteration >= MAX_ITERATIONS) {
      console.log(`\n[loop] Max iterations (${MAX_ITERATIONS}) reached — stopping`);
      break;
    }
    iteration++;

    const batchUrls = allUrls.slice(batchStart, batchStart + BATCH_SIZE);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[loop] Iteration ${iteration} — repos ${batchStart + 1}–${batchStart + batchUrls.length}`);
    console.log('='.repeat(60));

    // Step 1: Run
    const runId = generateRunId();
    console.log(`\n[loop] Step 1: Run — ID ${runId}`);
    await runCorpus(batchUrls, runId);
    allRunIds.push(runId);

    // Step 2: Evaluate
    console.log(`\n[loop] Step 2: Evaluate`);
    const summary = await evaluateRun(runId);
    if (!summary) {
      console.warn('[loop] Evaluation produced no summary — skipping improve');
      continue;
    }

    const currentOverall = summary.overall;

    // Step 3: Improve
    console.log(`\n[loop] Step 3: Improve`);
    const improveResult = await improve(runId, allRunIds);

    // Step 4: Print iteration summary
    const delta = prevOverall !== null ? currentOverall - prevOverall : null;
    printIterationSummary(iteration, runId, summary, improveResult, delta);

    // Step 5: Plateau check
    if (delta !== null && delta < PLATEAU_THRESHOLD) {
      console.log(`\n[loop] Plateau detected (improvement ${(delta * 100).toFixed(2)}% < ${PLATEAU_THRESHOLD * 100}%) — stopping`);
      break;
    }

    prevOverall = currentOverall;
  }

  // Final summary
  printFinalSummary(allRunIds, prevOverall);
}

function printIterationSummary(iteration, runId, summary, improveResult, delta) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Iteration ${iteration} summary`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`Run ID:    ${runId}`);
  console.log(`Repos:     ${summary.scoredCount}/${summary.repoCount} scored`);
  console.log(`Overall:   ${(summary.overall * 100).toFixed(1)}%${delta !== null ? ` (${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(2)}%)` : ''}`);

  if (improveResult.improved) {
    console.log(`Improved:  YES — patched section "${improveResult.section}"`);
    console.log(`           Regression run: ${improveResult.regressionRunId}`);
  } else {
    console.log(`Improved:  NO — ${improveResult.reason}`);
    if (improveResult.section) {
      console.log(`           Hard conflict on: ${improveResult.section}`);
    }
  }
}

function printFinalSummary(allRunIds, finalOverall) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Loop complete');
  console.log('='.repeat(60));
  console.log(`Total iterations: ${allRunIds.length}`);
  console.log(`Final overall score: ${finalOverall !== null ? `${(finalOverall * 100).toFixed(1)}%` : 'N/A'}`);
  console.log(`Run IDs: ${allRunIds.join(', ')}`);
  console.log(`\nHistory: benchmarks/history.yaml`);
}

main().catch(err => {
  console.error('[loop] Fatal error:', err);
  process.exit(1);
});
