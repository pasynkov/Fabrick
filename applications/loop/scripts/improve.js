#!/usr/bin/env node
/**
 * improve.js — patch SKILL.md via Opus based on failure cases
 *
 * 1. Read summary.yaml: identify lowest-scoring categories
 * 2. Select top 5 failure cases (question + expected + actual)
 * 3. Parse SKILL.md into sections by ### headings
 * 4. Identify responsible section for each failure
 * 5. Call Opus: send section + failures → receive patched section
 * 6. Apply patch, re-run corpus, regression check (>5% drop = reject)
 * 7. Up to 3 retry attempts per section; on failure log hard conflict
 * 8. On success: git commit SKILL.md with run-id
 *
 * Usage: node scripts/improve.js --run-id <id> [--prev-run-id <id>]
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawnSync } from 'child_process';
import yaml from 'js-yaml';
import { runCorpus, generateRunId } from './run.js';
import { evaluateRun } from './evaluate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOOP_ROOT = join(__dirname, '..');
const FABRICK_ROOT = join(LOOP_ROOT, '..', '..');
const SKILL_PATH = join(FABRICK_ROOT, '.claude', 'skills', 'fabrick-analyze', 'SKILL.md');
const BENCHMARKS_DIR = join(LOOP_ROOT, 'benchmarks');

const REGRESSION_THRESHOLD = 0.05; // 5% drop = reject
const MAX_RETRIES = 3;

/**
 * Run a prompt via claude -p (using Opus via --model flag). Returns stdout text or throws.
 */
function callClaude(prompt, model = 'claude-opus-4-6') {
  const result = spawnSync(
    'claude',
    ['-p', prompt, '--dangerously-skip-permissions', '--model', model],
    {
      encoding: 'utf8',
      timeout: 5 * 60 * 1000,
      maxBuffer: 5 * 1024 * 1024,
    }
  );
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) {
    throw new Error(`claude exit ${result.status}: ${(result.stderr || '').slice(0, 500)}`);
  }
  return result.stdout || '';
}

const SECTION_IDENTIFY_PROMPT = `You are analyzing why a code analysis skill produced incorrect output. Given these failure cases, identify which section of SKILL.md is most responsible.

SKILL.md sections (headings only):
{SECTIONS}

Failure cases:
{FAILURES}

Output as YAML:
section: "### Section Heading"
reason: "brief reason why this section is responsible"`;

const PATCH_PROMPT = `You are improving a code analysis skill. The current section has a deficiency — it fails to extract certain information correctly.

Current section:
---
{SECTION}
---

Failure cases (question / expected answer / what the skill actually produced):
{FAILURES}

Rewrite this section to fix these failures while keeping all existing capabilities. Return ONLY the patched section text, starting with the ### heading. No explanations, no wrapper text.`;

/**
 * Parse SKILL.md into sections keyed by heading.
 * Returns { heading: sectionText }
 */
function parseSections(content) {
  const sections = {};
  const lines = content.split('\n');
  let current = null;
  let buf = [];

  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (current !== null) {
        sections[current] = buf.join('\n');
      }
      current = line;
      buf = [line];
    } else if (current !== null) {
      buf.push(line);
    }
  }
  if (current !== null) {
    sections[current] = buf.join('\n');
  }
  return sections;
}

/**
 * Rebuild SKILL.md from sections, preserving preamble before first ###.
 */
function rebuildSkill(original, sections) {
  const firstHeading = original.indexOf('\n### ');
  const preamble = firstHeading !== -1 ? original.slice(0, firstHeading + 1) : '';
  return preamble + Object.values(sections).join('\n\n');
}

/**
 * Collect top N failure cases from a run's repos.
 * Failures = questions with verdict wrong or partial, sorted by impact.
 */
function collectFailures(runId, n = 5) {
  const runDir = join(BENCHMARKS_DIR, runId);
  const failures = [];

  for (const entry of readdirSync(runDir)) {
    const repoDir = join(runDir, entry);
    const qaPath = join(repoDir, 'qa_pairs.yaml');
    const scoresPath = join(repoDir, 'scores.yaml');
    if (!existsSync(qaPath) || !existsSync(scoresPath)) continue;

    const qa = yaml.load(readFileSync(qaPath, 'utf8'));
    const scores = yaml.load(readFileSync(scoresPath, 'utf8'));
    const questions = qa.questions || [];
    const verdicts = scores.verdicts || [];

    for (const verdict of verdicts) {
      if (verdict.verdict === 'wrong' || verdict.verdict === 'partial') {
        const q = questions.find(q => q.id === verdict.id);
        if (q) {
          failures.push({
            repo: entry,
            id: q.id,
            category: q.category,
            question: q.question,
            expectedAnswer: q.answer,
            verdict: verdict.verdict,
            reason: verdict.reason,
          });
        }
      }
    }
  }

  // Sort: wrong first, then partial; prioritize architectural + technical
  const catPrio = { architectural: 0, technical: 1, product: 2 };
  failures.sort((a, b) => {
    if (a.verdict !== b.verdict) return a.verdict === 'wrong' ? -1 : 1;
    return (catPrio[a.category] ?? 3) - (catPrio[b.category] ?? 3);
  });

  return failures.slice(0, n);
}

/**
 * Identify which SKILL.md section is responsible for a set of failures.
 */
async function identifySection(sections, failures) {
  const headingsOnly = Object.keys(sections).join('\n');
  const failuresText = failures.map(f =>
    `Q: ${f.question}\nExpected: ${f.expectedAnswer}\nCategory: ${f.category}`
  ).join('\n\n');

  const text = callClaude(
    SECTION_IDENTIFY_PROMPT
      .replace('{SECTIONS}', headingsOnly)
      .replace('{FAILURES}', failuresText),
  );
  const cleaned = text.replace(/^```ya?ml\s*/m, '').replace(/```\s*$/m, '').trim();
  const parsed = yaml.load(cleaned);
  return parsed?.section || null;
}

/**
 * Get patched section from Opus.
 */
async function patchSection(section, failures) {
  const failuresText = failures.map(f =>
    `Question: ${f.question}\nExpected: ${f.expectedAnswer}\nCategory: ${f.category}\nVerdict: ${f.verdict}`
  ).join('\n\n---\n\n');

  return callClaude(
    PATCH_PROMPT
      .replace('{SECTION}', section)
      .replace('{FAILURES}', failuresText),
  );
}

/**
 * Load all scores from a run as { repoName: { cat: score } }.
 */
function loadRunScores(runId) {
  const runDir = join(BENCHMARKS_DIR, runId);
  const scores = {};
  for (const entry of readdirSync(runDir)) {
    const scoresPath = join(join(runDir, entry), 'scores.yaml');
    if (!existsSync(scoresPath)) continue;
    const data = yaml.load(readFileSync(scoresPath, 'utf8'));
    scores[entry] = data.scores;
  }
  return scores;
}

/**
 * Check regression: compare new scores vs baseline.
 * Returns { passed, regressions[] }.
 */
function checkRegression(baselineScores, newScores) {
  const regressions = [];
  for (const [repo, baseline] of Object.entries(baselineScores)) {
    const newS = newScores[repo];
    if (!newS) continue;
    for (const [cat, baseVal] of Object.entries(baseline)) {
      const newVal = newS[cat] ?? 0;
      const drop = baseVal - newVal;
      if (drop > REGRESSION_THRESHOLD) {
        regressions.push({ repo, category: cat, baseline: baseVal, new: newVal, drop });
      }
    }
  }
  return { passed: regressions.length === 0, regressions };
}

/**
 * Git commit SKILL.md with run-id in message.
 */
function commitSkill(runId) {
  execSync(`git -C "${FABRICK_ROOT}" add "${SKILL_PATH}"`);
  execSync(
    `git -C "${FABRICK_ROOT}" commit -m "improve: fabrick-analyze SKILL.md — loop run ${runId}"`,
    { stdio: 'pipe' }
  );
}

/**
 * Improve SKILL.md based on failures from runId.
 * allRunIds = all run IDs processed so far (for regression check).
 */
export async function improve(runId, allRunIds) {
  const summaryPath = join(BENCHMARKS_DIR, runId, 'summary.yaml');
  const summary = yaml.load(readFileSync(summaryPath, 'utf8'));

  console.log(`\n[improve] Run ${runId} overall: ${(summary.overall * 100).toFixed(1)}%`);

  const failures = collectFailures(runId);
  if (failures.length === 0) {
    console.log('[improve] No failures found — nothing to improve');
    return { improved: false, reason: 'no failures' };
  }

  console.log(`[improve] Found ${failures.length} failure cases`);

  // Parse SKILL.md
  const originalSkill = readFileSync(SKILL_PATH, 'utf8');
  const sections = parseSections(originalSkill);

  // Identify responsible section
  const sectionHeading = await identifySection(sections, failures);
  if (!sectionHeading || !sections[sectionHeading]) {
    console.warn(`[improve] Could not identify responsible section (got: ${sectionHeading})`);
    return { improved: false, reason: 'section not identified' };
  }

  console.log(`[improve] Targeting section: ${sectionHeading}`);

  // Collect baseline scores (all repos seen so far)
  const baselineScores = {};
  for (const rid of allRunIds) {
    Object.assign(baselineScores, loadRunScores(rid));
  }

  // Patch loop (up to MAX_RETRIES)
  let attempt = 0;
  let hardConflict = false;
  const corpusPath = join(LOOP_ROOT, 'corpus.yaml');
  const corpus = yaml.load(readFileSync(corpusPath, 'utf8'));
  const allUrls = (corpus.repos || []).map(r => r.url);

  while (attempt < MAX_RETRIES) {
    attempt++;
    console.log(`[improve] Attempt ${attempt}/${MAX_RETRIES} — patching section`);

    const patched = await patchSection(sections[sectionHeading], failures);
    if (!patched.trim()) {
      console.warn('[improve] Empty patch received');
      continue;
    }

    // Apply patch
    const newSections = { ...sections, [sectionHeading]: patched };
    const newContent = rebuildSkill(originalSkill, newSections);
    writeFileSync(SKILL_PATH, newContent);

    // Re-run corpus with patched skill
    console.log('[improve] Re-running corpus with patched SKILL.md...');
    const regressionRunId = generateRunId();
    const corpusSubset = allUrls.slice(0, (allRunIds.length + 1) * 5); // all repos seen so far
    await runCorpus(corpusSubset, regressionRunId);
    await evaluateRun(regressionRunId);

    const newScores = loadRunScores(regressionRunId);
    const { passed, regressions } = checkRegression(baselineScores, newScores);

    if (passed) {
      console.log('[improve] Regression check passed — committing patch');
      commitSkill(runId);
      return { improved: true, section: sectionHeading, regressionRunId };
    }

    console.warn(`[improve] Regression detected (${regressions.length} issues):`);
    for (const r of regressions) {
      console.warn(`  ${r.repo}/${r.category}: ${(r.baseline * 100).toFixed(1)}% → ${(r.new * 100).toFixed(1)}% (−${(r.drop * 100).toFixed(1)}%)`);
    }

    // Restore original SKILL.md before retry
    writeFileSync(SKILL_PATH, originalSkill);

    if (attempt === MAX_RETRIES) {
      hardConflict = true;
    }
  }

  // Log hard conflict to summary
  const hardConflictNote = { hardConflict: true, section: sectionHeading, attempts: MAX_RETRIES };
  summary.hardConflicts = [...(summary.hardConflicts || []), hardConflictNote];
  writeFileSync(summaryPath, yaml.dump(summary));
  console.error(`[improve] Hard conflict on section "${sectionHeading}" — skipping after ${MAX_RETRIES} attempts`);

  return { improved: false, reason: 'hard conflict', section: sectionHeading };
}

// CLI entrypoint
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ridIdx = process.argv.indexOf('--run-id');
  if (ridIdx === -1) {
    console.error('Usage: node scripts/improve.js --run-id <id> [--all-runs <id1,id2,...>]');
    process.exit(1);
  }
  const runId = process.argv[ridIdx + 1];

  const allRunsIdx = process.argv.indexOf('--all-runs');
  const allRunIds = allRunsIdx !== -1
    ? process.argv[allRunsIdx + 1].split(',')
    : [runId];

  improve(runId, allRunIds).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
