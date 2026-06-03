import { callClaude } from '../llm/cli.js';
import { generateArchPagePrompt, patchArchPagePrompt, synthesisNarratorPrompt } from '../llm/synthesis-prompts.js';

export async function generateArchPage({ archSlug, wikiExcerpts, claudeOpts = {} }) {
  const prompt = generateArchPagePrompt({ archSlug, wikiExcerpts });
  const res = await callClaude(prompt, claudeOpts);
  return { content: res.content.trim() + '\n', rawResponse: res.content, prompt, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
}

export async function patchArchPage({ archSlug, existingPage, narrative, wikiExcerpts, changeReasons, claudeOpts = {} }) {
  const prompt = patchArchPagePrompt({ archSlug, existingPage, narrative, wikiExcerpts, changeReasons });
  const res = await callClaude(prompt, claudeOpts);
  return { content: res.content.trim() + '\n', rawResponse: res.content, prompt, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
}

export async function generateSynthesisNarrative({ diff, recentWikiUpdates, claudeOpts = {} }) {
  const prompt = synthesisNarratorPrompt({ diff, recentWikiUpdates });
  const res = await callClaude(prompt, claudeOpts);
  return { narrative: res.content.trim(), prompt, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
}
