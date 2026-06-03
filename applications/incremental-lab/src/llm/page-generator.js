import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { callClaude } from './cli.js';
import { generatePagePrompt, patchPagePrompt, patchPagePromptSlim } from './prompts.js';
import { buildSlimChangeContext, currentSymbolSignatures } from './diff-context.js';

export async function generatePage({ slug, symbols, repoRoot, claudeOpts = {} }) {
  const sources = loadSources(symbols, repoRoot);
  const prompt = generatePagePrompt({ slug, symbols, sources });
  const res = await callClaude(prompt, claudeOpts);
  return { content: res.content.trim() + '\n', rawResponse: res.content, prompt, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
}

export async function patchPage({ slug, existingPage, changes, symbols, repoRoot, claudeOpts = {} }) {
  const sources = loadSources(symbols, repoRoot);
  const prompt = patchPagePrompt({ slug, existingPage, changes, symbols, sources });
  const res = await callClaude(prompt, claudeOpts);
  return { content: res.content.trim() + '\n', rawResponse: res.content, prompt, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
}

export async function patchPageSlim({ slug, existingPage, diff, symbols, claudeOpts = {} }) {
  const pageSymbolIds = new Set(symbols.map((s) => s.id));
  const changeContext = buildSlimChangeContext({ pageSymbolIds, diff });
  const currentSignatures = currentSymbolSignatures({ symbols });
  const prompt = patchPagePromptSlim({ slug, existingPage, changeContext, currentSignatures });
  const res = await callClaude(prompt, claudeOpts);
  return { content: res.content.trim() + '\n', usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs, promptBytes: prompt.length };
}

function loadSources(symbols, repoRoot) {
  const files = [...new Set(symbols.map((s) => s.file))].sort();
  return files.map((file) => ({
    file,
    content: readFileSync(join(repoRoot, file), 'utf8'),
  }));
}
