import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { callClaude } from '../llm/cli.js';
import { generateAppScopePrompt, patchAppScopePrompt, parseAppPagesOutput } from '../llm/app-page-prompts.js';

const MAX_FILES = 60;          // hard cap on source files passed in one prompt
const MAX_FILE_BYTES = 8000;   // per-file truncation

function loadScopeSources(scopePath, files) {
  const sliced = files.slice(0, MAX_FILES);
  return sliced.map((file) => {
    let content;
    try { content = readFileSync(join(scopePath, file), 'utf8'); }
    catch { return null; }
    if (content.length > MAX_FILE_BYTES) content = content.slice(0, MAX_FILE_BYTES) + '\n...';
    return { file, content };
  }).filter(Boolean);
}

/**
 * Single-call baseline generator for ONE app scope: produces all 4 pages.
 */
export async function generateAppScope({ scopePath, scopeName, scopeKind, repoName, sourceFiles, claudeOpts = {} }) {
  const sources = loadScopeSources(scopePath, sourceFiles);
  const built = generateAppScopePrompt({ scopeName, scopeKind, repoName, sources });
  const res = await callClaude(built, claudeOpts);
  const pages = parseAppPagesOutput(res.content);
  return {
    pages, rawResponse: res.content,
    prompt: `--- system ---\n${built.system}\n\n--- user ---\n${built.user}`,
    usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs,
  };
}

/**
 * Single-call patcher for ONE app scope: regenerates all 4 pages using
 * existing bodies + essence features. No source code in prompt — essence
 * is the authoritative diff signal.
 */
export async function patchAppScope({ scopeName, scopeKind, repoName, existingPages, features, claudeOpts = {} }) {
  const built = patchAppScopePrompt({ scopeName, scopeKind, repoName, existingPages, features });
  const res = await callClaude(built, claudeOpts);
  const pages = parseAppPagesOutput(res.content);
  return {
    pages, rawResponse: res.content,
    prompt: `--- system ---\n${built.system}\n\n--- user ---\n${built.user}`,
    usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs,
  };
}
