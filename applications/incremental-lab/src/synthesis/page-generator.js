import { callClaude } from '../llm/cli.js';
import {
  generateArchPagePrompt,
  patchArchPagePrompt,
  mcpDescriptionPrompt,
  mcpInstructionsPrompt,
} from '../llm/synthesis-prompts.js';

/**
 * Per-page generator: write ONE project wiki page from scratch.
 */
export async function generateArchPage({ page, wikiExcerpts, claudeOpts = {} }) {
  const prompt = generateArchPagePrompt({
    archSlug: page.archSlug,
    title: page.title,
    description: page.description,
    wikiExcerpts,
  });
  const res = await callClaude(prompt, claudeOpts);
  return { content: res.content.trim() + '\n', rawResponse: res.content, prompt, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
}

/**
 * Per-page patcher: update ONE project wiki page given existing body + wiki delta.
 */
export async function patchArchPage({ page, existingPage, wikiExcerpts, wikiPatchSummary, claudeOpts = {} }) {
  const prompt = patchArchPagePrompt({
    archSlug: page.archSlug,
    title: page.title,
    description: page.description,
    existingPage,
    wikiExcerpts,
    wikiPatchSummary,
  });
  const res = await callClaude(prompt, claudeOpts);
  return { content: res.content.trim() + '\n', rawResponse: res.content, prompt, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
}

export async function generateMcpDescription({ taxonomy, repos, claudeOpts = {} }) {
  const prompt = mcpDescriptionPrompt({ taxonomy, repos });
  const res = await callClaude(prompt, claudeOpts);
  return { content: res.content.trim() + '\n', rawResponse: res.content, prompt, usage: res.usage, costUsd: res.costUsd };
}

export async function generateMcpInstructions({ taxonomy, repos, claudeOpts = {} }) {
  const prompt = mcpInstructionsPrompt({ taxonomy, repos });
  const res = await callClaude(prompt, claudeOpts);
  return { content: res.content.trim() + '\n', rawResponse: res.content, prompt, usage: res.usage, costUsd: res.costUsd };
}
