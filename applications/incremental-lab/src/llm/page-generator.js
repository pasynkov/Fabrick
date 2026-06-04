import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { callClaude } from './cli.js';
import { generatePagePrompt, patchPagePrompt, patchPagePromptSlim, patchPagePromptNarrative, patchPageFromEssencePrompt } from './prompts.js';
import { buildSlimChangeContext, currentSymbolSignatures, buildReferencesBlock } from './diff-context.js';

export async function generatePage({ slug, symbols, repoRoot, claudeOpts = {} }) {
  const sources = loadSources(symbols, repoRoot);
  const prompt = generatePagePrompt({ slug, symbols, sources });
  const res = await callClaude(prompt, claudeOpts);
  return { content: res.content.trim() + '\n', rawResponse: res.content, prompt, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
}

export async function patchPage({ slug, existingPage, changes, symbols, repoRoot, beforeSnapshotSymbols = null, afterSnapshotSymbols = null, claudeOpts = {} }) {
  const sources = loadSources(symbols, repoRoot);
  const referencesBlock = afterSnapshotSymbols
    ? buildReferencesBlock({ pageSymbols: symbols, beforeSymbols: beforeSnapshotSymbols ?? [], afterSymbols: afterSnapshotSymbols })
    : '';
  const prompt = patchPagePrompt({ slug, existingPage, changes, symbols, sources, referencesBlock });
  const res = await callClaude(prompt, claudeOpts);
  return { content: res.content.trim() + '\n', rawResponse: res.content, prompt, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
}

export async function patchPageWithNarrative({ slug, existingPage, commitNarrative, diff, symbols, beforeSnapshotSymbols = null, afterSnapshotSymbols = null, claudeOpts = {} }) {
  const pageSymbolIds = new Set(symbols.map((s) => s.id));
  const pageFocus = buildSlimChangeContext({ pageSymbolIds, diff });
  const currentSignatures = currentSymbolSignatures({ symbols });
  const referencesBlock = afterSnapshotSymbols
    ? buildReferencesBlock({ pageSymbols: symbols, beforeSymbols: beforeSnapshotSymbols ?? [], afterSymbols: afterSnapshotSymbols })
    : '';
  const prompt = patchPagePromptNarrative({ slug, existingPage, commitNarrative, pageFocus, currentSignatures, referencesBlock });
  const res = await callClaude(prompt, claudeOpts);
  return { content: res.content.trim() + '\n', rawResponse: res.content, prompt, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs, promptBytes: prompt.length };
}

/**
 * Essence-driven patcher: apply a filtered list of feature items to one page.
 * No raw source files — features already encode what changed.
 */
export async function patchPageFromEssence({ slug, existingPage, features, symbols, claudeOpts = {} }) {
  const currentSignatures = currentSymbolSignatures({ symbols });
  const built = patchPageFromEssencePrompt({ slug, existingPage, features, currentSignatures });
  // built = { system, user } so the system block (instructions + taxonomy +
  // format) can be cached by Anthropic across the parallel subagent calls.
  const res = await callClaude(built, claudeOpts);
  const promptBytes = (built.system?.length ?? 0) + (built.user?.length ?? 0);
  return { content: res.content.trim() + '\n', rawResponse: res.content, prompt: `--- system ---\n${built.system}\n\n--- user ---\n${built.user}`, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs, promptBytes };
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
