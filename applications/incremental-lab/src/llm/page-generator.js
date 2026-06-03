import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { callClaude } from './cli.js';
import { generatePagePrompt, patchPagePrompt } from './prompts.js';

export async function generatePage({ slug, symbols, repoRoot, claudeOpts = {} }) {
  const sources = loadSources(symbols, repoRoot);
  const prompt = generatePagePrompt({ slug, symbols, sources });
  const res = await callClaude(prompt, claudeOpts);
  return { content: res.content.trim() + '\n', usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
}

export async function patchPage({ slug, existingPage, changes, symbols, repoRoot, claudeOpts = {} }) {
  const sources = loadSources(symbols, repoRoot);
  const prompt = patchPagePrompt({ slug, existingPage, changes, symbols, sources });
  const res = await callClaude(prompt, claudeOpts);
  return { content: res.content.trim() + '\n', usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
}

function loadSources(symbols, repoRoot) {
  const files = [...new Set(symbols.map((s) => s.file))].sort();
  return files.map((file) => ({
    file,
    content: readFileSync(join(repoRoot, file), 'utf8'),
  }));
}
