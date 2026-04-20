#!/usr/bin/env node
/**
 * run.js — clone corpus repos, run fabrick-analyze on each, store output
 *
 * Usage: node scripts/run.js [--run-id <id>]
 * Output: benchmarks/<run-id>/<repo-name>/output/
 */

import { readFileSync, mkdirSync, cpSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import yaml from 'js-yaml';
import { simpleGit } from 'simple-git';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOOP_ROOT = join(__dirname, '..');
const FABRICK_ROOT = join(LOOP_ROOT, '..', '..');
const SKILLS_DIR = join(FABRICK_ROOT, '.claude', 'skills', 'fabrick-analyze');
const BENCHMARKS_DIR = join(LOOP_ROOT, 'benchmarks');

/**
 * Generate run ID: YYYY-MM-DD-NNN (sequential per day)
 */
export function generateRunId() {
  const today = new Date().toISOString().slice(0, 10);
  const prefix = `${today}-`;
  const existing = existsSync(BENCHMARKS_DIR)
    ? readdirSync(BENCHMARKS_DIR).filter(d => d.startsWith(prefix))
    : [];
  const seq = String(existing.length + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

/**
 * Clone a repo shallowly into a temp dir. Returns path.
 */
async function cloneRepo(url) {
  const dir = join(tmpdir(), `fabrick-loop-${randomBytes(6).toString('hex')}`);
  const git = simpleGit();
  await git.clone(url, dir, ['--depth', '1']);
  return dir;
}

/**
 * Copy skills into cloned repo so fabrick-analyze can read them.
 */
function copySkills(repoDir) {
  const dest = join(repoDir, '.claude', 'skills', 'fabrick-analyze');
  mkdirSync(dest, { recursive: true });
  cpSync(SKILLS_DIR, dest, { recursive: true });
}

/**
 * Read SKILL.md content, stripping YAML frontmatter.
 */
function getSkillPrompt() {
  const content = readFileSync(join(SKILLS_DIR, 'SKILL.md'), 'utf8');
  // Strip ---...--- frontmatter if present
  if (content.startsWith('---')) {
    const end = content.indexOf('\n---', 3);
    if (end !== -1) return content.slice(end + 4).trimStart();
  }
  return content;
}

/**
 * Run fabrick-analyze in the cloned repo. Returns { success, error }.
 */
function runAnalyze(repoDir) {
  const prompt = getSkillPrompt();
  const result = spawnSync('claude', ['-p', prompt, '--dangerously-skip-permissions'], {
    cwd: repoDir,
    encoding: 'utf8',
    timeout: 10 * 60 * 1000, // 10 min
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    return { success: false, error: result.error.message };
  }
  if (result.status !== 0) {
    const stderr = result.stderr || '';
    const stdout = result.stdout || '';
    return { success: false, error: `exit ${result.status}\n${stderr}\n${stdout}`.trim() };
  }
  return { success: true };
}

/**
 * Copy .fabrick/context/ from cloned repo to output dir.
 */
function copyOutput(repoDir, outputDir) {
  const contextDir = join(repoDir, '.fabrick', 'context');
  if (!existsSync(contextDir)) {
    throw new Error('.fabrick/context not found after analysis');
  }
  mkdirSync(outputDir, { recursive: true });
  cpSync(contextDir, outputDir, { recursive: true });
}

/**
 * Derive a short name from a repo URL.
 */
function repoName(url) {
  return url.replace(/\.git$/, '').split('/').slice(-1)[0];
}

/**
 * Run analysis for all repos in corpus.
 *
 * @param {string[]} urls - List of repo URLs
 * @param {string} runId - Run ID (e.g. 2026-04-17-001)
 * @returns {object} runMeta
 */
export async function runCorpus(urls, runId) {
  const runDir = join(BENCHMARKS_DIR, runId);
  mkdirSync(runDir, { recursive: true });

  const results = [];

  for (const url of urls) {
    const name = repoName(url);
    console.log(`\n[run] ${name} — cloning ${url}`);

    const repoOutputDir = join(runDir, name);
    const outputDir = join(repoOutputDir, 'output');
    let cloneDir = null;

    try {
      cloneDir = await cloneRepo(url);
      console.log(`[run] ${name} — cloned to ${cloneDir}`);

      copySkills(cloneDir);

      console.log(`[run] ${name} — running fabrick-analyze`);
      const { success, error } = runAnalyze(cloneDir);

      if (!success) {
        throw new Error(error);
      }

      copyOutput(cloneDir, outputDir);
      console.log(`[run] ${name} — output saved to ${outputDir}`);
      results.push({ name, url, status: 'ok' });
    } catch (err) {
      console.error(`[run] ${name} — FAILED: ${err.message}`);
      mkdirSync(join(runDir, name), { recursive: true });
      writeFileSync(join(runDir, name, 'error.txt'), err.message);
      results.push({ name, url, status: 'error', error: err.message });
    } finally {
      if (cloneDir) {
        try {
          execSync(`rm -rf "${cloneDir}"`);
        } catch {}
      }
    }
  }

  // Write run manifest
  const manifest = { runId, date: new Date().toISOString(), repos: results };
  writeFileSync(join(runDir, 'run.yaml'), yaml.dump(manifest));

  console.log(`\n[run] Done. Run ID: ${runId}`);
  console.log(`[run] ${results.filter(r => r.status === 'ok').length}/${results.length} succeeded`);

  return manifest;
}

// CLI entrypoint
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const corpusPath = join(LOOP_ROOT, 'corpus.yaml');
  const corpus = yaml.load(readFileSync(corpusPath, 'utf8'));
  const urls = (corpus.repos || []).map(r => r.url);

  if (urls.length === 0) {
    console.error('corpus.yaml has no repos. Add repos first.');
    process.exit(1);
  }

  const runId = process.argv.includes('--run-id')
    ? process.argv[process.argv.indexOf('--run-id') + 1]
    : generateRunId();

  runCorpus(urls, runId).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
