/**
 * Append-only patch log per repo. Records every wiki patch/regen so the
 * project evolution is traceable. Works uniformly across "compute+apply
 * patch" and "auto/forced regen" — diff captured deterministically from
 * markdown extractor, no extra LLM call.
 *
 *   <repo>/.fabrick/patches.log.jsonl
 *     {at,baselineSha,headSha,title,prNumber?,scopes:[{name,mode,counts,sampleChanges}]}
 */

import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractMarkdownSymbols, diffMarkdownSymbols } from '../extract/markdown.js';
import { stripFrontmatter } from './frontmatter.js';
import { APP_PAGE_SLUGS } from './app-taxonomy.js';

/**
 * Snapshot current page bodies (already in `existingPages`) keyed by slug.
 * No I/O — caller already stripped frontmatter.
 */
export function snapshotPages(existingPages) {
  const out = {};
  for (const slug of APP_PAGE_SLUGS) out[slug] = existingPages[slug] ?? '';
  return out;
}

/**
 * Read current pages from disk (after a patch/regen), strip frontmatter,
 * return as { slug: body }.
 */
export function readPagesAfter(scopeOut) {
  const out = {};
  for (const slug of APP_PAGE_SLUGS) {
    const p = join(scopeOut, slug);
    if (existsSync(p)) out[slug] = stripFrontmatter(readFileSync(p, 'utf8')).content;
  }
  return out;
}

/**
 * Build per-scope summary for the log entry by diffing before/after page
 * symbol sets. Deterministic — uses markdown extractor only.
 */
export function summariseScopeChange({ scopeName, mode, before, after }) {
  const slugCounts = {};
  const sample = [];
  for (const slug of APP_PAGE_SLUGS) {
    const a = before[slug] ?? '';
    const b = after[slug] ?? '';
    if (a === b) continue;
    const symsA = extractMarkdownSymbols(slug, a);
    const symsB = extractMarkdownSymbols(slug, b);
    const d = diffMarkdownSymbols(symsA, symsB);
    slugCounts[slug] = { added: d.added.length, removed: d.deleted.length, changed: d.changed.length };
    for (const s of d.added.slice(0, 2)) sample.push(`+${slug}:${labelOf(s)}`);
    for (const s of d.deleted.slice(0, 1)) sample.push(`-${slug}:${labelOf(s)}`);
    for (const c of d.changed.slice(0, 1)) sample.push(`~${slug}:${labelOf(c.after)}`);
  }
  return { scope: scopeName, mode, slugCounts, sample: sample.slice(0, 8) };
}

function labelOf(s) {
  if (s.kind === 'bullet') return s.label;
  if (s.kind === 'table_row') return s.key;
  if (s.kind === 'section') return s.sectionPath.slice(-1)[0] ?? '';
  return '';
}

/**
 * Append one entry to <repo>/.fabrick/patches.log.jsonl.
 */
export function appendPatchLog(repoPath, entry) {
  const p = join(repoPath, '.fabrick', 'patches.log.jsonl');
  appendFileSync(p, JSON.stringify(entry) + '\n');
}

/**
 * Resolve patch title. Priority: --title > --pr > git log subject.
 * Returns { title, prNumber? }.
 */
export async function resolveTitle({ git, baselineSha, headSha, explicitTitle, prNumber }) {
  if (explicitTitle) return { title: explicitTitle, prNumber: prNumber ?? null };
  if (prNumber != null) {
    const subject = await safeGitSubject(git, baselineSha, headSha);
    return { title: `PR #${prNumber}${subject ? `: ${subject}` : ''}`, prNumber };
  }
  const subject = await safeGitSubject(git, baselineSha, headSha);
  return { title: subject || `${baselineSha.slice(0, 7)}..${headSha.slice(0, 7)}`, prNumber: null };
}

async function safeGitSubject(git, baselineSha, headSha) {
  try {
    const raw = await git.raw(['log', `${baselineSha}..${headSha}`, '--pretty=%s', '-1']);
    return raw.trim();
  } catch { return ''; }
}

/**
 * Summarise a deletion (scope present in baseline state, absent from
 * current detectScopes() output). Removes wiki dir, returns log entry.
 */
export function summariseDeletion({ scopeName, scopeDir, mode = 'deleted' }) {
  const entry = { scope: scopeName, mode, removedSlugs: [] };
  if (existsSync(scopeDir)) {
    try {
      const files = readdirSync(scopeDir);
      entry.removedSlugs = files.filter((f) => f.endsWith('.md'));
    } catch {}
  }
  return entry;
}
