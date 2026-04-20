#!/usr/bin/env node
/**
 * evaluate.js — Q&A accuracy scoring via claude -p subprocess calls
 *
 * For each repo in a run:
 *   1. Read .fabrick/context/ output files
 *   2. Generate Q&A pairs from context (ground truth from the analysis itself)
 *   3. Answer same questions using ONLY .fabrick/context/ output
 *   4. Score answers per category (technical 40%, product 35%, architectural 25%)
 *   5. Write qa_pairs.yaml, scores.yaml, summary.yaml
 *
 * Usage: node scripts/evaluate.js --run-id <id>
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOOP_ROOT = join(__dirname, '..');
const BENCHMARKS_DIR = join(LOOP_ROOT, 'benchmarks');

const CATEGORY_WEIGHTS = {
  technical: 0.40,
  product: 0.35,
  architectural: 0.25,
};

const QA_GENERATION_PROMPT = `You are evaluating the quality of a code analysis tool. Given structured analysis output from a repository, generate exactly 12 questions that test whether the analysis captures important information.

Distribute questions as:
- 5 technical: "What message broker is used?", "What database?", "What env vars are required?", "What HTTP endpoints exposed?", "What external APIs called?"
- 4 product: "What is the business purpose of this app?", "What happens on payment failure?", "What are the supported currencies?", "What business rules govern X?"
- 3 architectural: "What events does this service publish?", "What services does it depend on?", "What protocols does it use?"

For each question, also provide the correct answer based on the analysis.

Output as YAML only (no markdown fences):
questions:
  - id: q1
    category: technical
    question: "..."
    answer: "..."
  - id: q2
    category: product
    question: "..."
    answer: "..."

Analysis output:
---
{SOURCE}
---`;

const QA_ANSWERING_PROMPT = `You are evaluating a code analysis tool. Answer the following questions using ONLY the structured analysis output provided. Do not use any prior knowledge. If the answer cannot be found in the analysis, say "NOT_FOUND".

Output as YAML only (no markdown fences):
answers:
  - id: q1
    answer: "..."
  - id: q2
    answer: "..."

Analysis output:
---
{CONTEXT}
---

Questions:
{QUESTIONS}`;

const SCORING_PROMPT = `Compare each expected answer with the actual answer and determine if the actual answer is correct.

An answer is CORRECT if it captures the key fact, even if phrased differently.
An answer is PARTIAL if it captures some but not all key facts.
An answer is WRONG if it misses the key fact or says NOT_FOUND.

Output as YAML only (no markdown fences):
scores:
  - id: q1
    verdict: correct|partial|wrong
    reason: "brief reason"
  - id: q2
    verdict: correct|partial|wrong
    reason: "brief reason"

Expected answers:
{EXPECTED}

Actual answers:
{ACTUAL}`;

/**
 * Run a prompt via claude -p. Returns stdout text or throws.
 */
function callClaude(prompt) {
  const result = spawnSync('claude', ['-p', prompt, '--dangerously-skip-permissions'], {
    encoding: 'utf8',
    timeout: 5 * 60 * 1000, // 5 min per call
    maxBuffer: 5 * 1024 * 1024,
  });

  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) {
    throw new Error(`claude exit ${result.status}: ${(result.stderr || '').slice(0, 500)}`);
  }
  return result.stdout || '';
}

/**
 * Collect .fabrick/context/ output as a single string (capped at 30k chars).
 */
function collectContextOutput(repoDir) {
  const outputDir = join(repoDir, 'output');
  if (!existsSync(outputDir)) return '';

  let combined = '';
  const walk = (dir) => {
    try {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) walk(full);
        else if (['.yaml', '.md'].includes(extname(entry).toLowerCase())) {
          try {
            combined += `\n\n### ${full.replace(repoDir, '')}\n${readFileSync(full, 'utf8')}`;
          } catch {}
        }
      }
    } catch {}
  };
  walk(outputDir);
  return combined.slice(0, 30000);
}

/**
 * Parse YAML from model output (strip code fences if present).
 */
function parseYamlOutput(text) {
  const cleaned = text.replace(/^```ya?ml\s*/m, '').replace(/```\s*$/m, '').trim();
  return yaml.load(cleaned);
}

/**
 * Score verdicts into numeric 0–1 per question.
 */
function verdictToScore(verdict) {
  if (verdict === 'correct') return 1.0;
  if (verdict === 'partial') return 0.5;
  return 0.0;
}

/**
 * Evaluate all repos in a run. Returns summary.
 */
export async function evaluateRun(runId) {
  const runDir = join(BENCHMARKS_DIR, runId);

  const runManifest = yaml.load(readFileSync(join(runDir, 'run.yaml'), 'utf8'));
  const successfulRepos = runManifest.repos.filter(r => r.status === 'ok');

  console.log(`[eval] Evaluating ${successfulRepos.length} repos from run ${runId}`);

  if (successfulRepos.length === 0) {
    console.error('[eval] No repos to evaluate');
    return null;
  }

  const repoScores = {};

  for (const repo of successfulRepos) {
    const repoDir = join(runDir, repo.name);
    const context = collectContextOutput(repoDir);

    if (!context) {
      console.warn(`[eval] ${repo.name} — no context output found, skipping`);
      continue;
    }

    console.log(`[eval] ${repo.name} — generating Q&A pairs`);

    // Step 1: Generate Q&A from context
    let questions;
    try {
      const genOutput = callClaude(QA_GENERATION_PROMPT.replace('{SOURCE}', context));
      const parsed = parseYamlOutput(genOutput);
      questions = parsed.questions || [];
      writeFileSync(join(repoDir, 'qa_pairs.yaml'), yaml.dump({ questions }));
      console.log(`[eval] ${repo.name} — generated ${questions.length} Q&A pairs`);
    } catch (err) {
      console.warn(`[eval] ${repo.name} — Q&A generation failed: ${err.message}`);
      continue;
    }

    if (questions.length === 0) {
      console.warn(`[eval] ${repo.name} — no questions generated, skipping`);
      continue;
    }

    // Step 2: Answer questions using only context
    console.log(`[eval] ${repo.name} — answering questions from context`);
    let actualAnswers;
    try {
      const questionsText = questions.map(q => `${q.id}: ${q.question}`).join('\n');
      const ansOutput = callClaude(
        QA_ANSWERING_PROMPT
          .replace('{CONTEXT}', context)
          .replace('{QUESTIONS}', questionsText),
      );
      const parsed = parseYamlOutput(ansOutput);
      actualAnswers = parsed.answers || [];
    } catch (err) {
      console.warn(`[eval] ${repo.name} — answering failed: ${err.message}`);
      continue;
    }

    // Step 3: Score answers
    console.log(`[eval] ${repo.name} — scoring answers`);
    try {
      const expected = questions.map(q => `${q.id}: ${q.answer}`).join('\n');
      const actual = actualAnswers.map(a => `${a.id}: ${a.answer}`).join('\n');

      const scoreOutput = callClaude(
        SCORING_PROMPT
          .replace('{EXPECTED}', expected)
          .replace('{ACTUAL}', actual),
      );
      const scoreParsed = parseYamlOutput(scoreOutput);
      const verdicts = scoreParsed.scores || [];

      // Compute per-category scores
      const catScores = { technical: [], product: [], architectural: [] };
      for (const verdict of verdicts) {
        const q = questions.find(q => q.id === verdict.id);
        if (q && catScores[q.category]) {
          catScores[q.category].push(verdictToScore(verdict.verdict));
        }
      }

      const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const scores = {
        technical: avg(catScores.technical),
        product: avg(catScores.product),
        architectural: avg(catScores.architectural),
      };
      const overall = Object.entries(CATEGORY_WEIGHTS)
        .reduce((sum, [cat, w]) => sum + scores[cat] * w, 0);

      const scoresDoc = { scores, overall, verdicts };
      writeFileSync(join(repoDir, 'scores.yaml'), yaml.dump(scoresDoc));
      repoScores[repo.name] = { scores, overall };
      console.log(`[eval] ${repo.name} — overall: ${(overall * 100).toFixed(1)}%`);
    } catch (err) {
      console.warn(`[eval] ${repo.name} — scoring failed: ${err.message}`);
    }
  }

  // Load previous run for delta
  const historyPath = join(LOOP_ROOT, 'benchmarks', 'history.yaml');
  const history = yaml.load(readFileSync(historyPath, 'utf8')) || { runs: [] };
  const prevRun = history.runs[history.runs.length - 1];

  // Compute aggregate
  const allOveralls = Object.values(repoScores).map(r => r.overall);
  const overallAvg = allOveralls.length ? allOveralls.reduce((a, b) => a + b, 0) / allOveralls.length : 0;
  const delta = prevRun ? overallAvg - prevRun.overall : null;

  const summary = {
    runId,
    date: new Date().toISOString(),
    repoCount: successfulRepos.length,
    scoredCount: Object.keys(repoScores).length,
    overall: overallAvg,
    delta,
    repos: repoScores,
  };

  writeFileSync(join(runDir, 'summary.yaml'), yaml.dump(summary));

  // Append to history
  history.runs.push({ runId, date: summary.date, overall: overallAvg });
  writeFileSync(historyPath, yaml.dump(history));

  console.log(`\n[eval] Run ${runId} overall score: ${(overallAvg * 100).toFixed(1)}%`);
  if (delta !== null) {
    console.log(`[eval] Delta vs previous: ${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`);
  }

  return summary;
}

// CLI entrypoint
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const idx = process.argv.indexOf('--run-id');
  if (idx === -1) {
    console.error('Usage: node scripts/evaluate.js --run-id <id>');
    process.exit(1);
  }
  const runId = process.argv[idx + 1];

  evaluateRun(runId).catch(err => {
    console.error('[eval] Fatal error:', err);
    process.exit(1);
  });
}
