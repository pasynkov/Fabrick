import { callClaude } from '../llm/cli.js';
import {
  SYNTHESIS_PROMPT,
  buildSynthesisFullInput,
  buildSynthesisIncrementalInput,
  parseSynthesisOutput,
} from '../llm/synthesis-prompts.js';

/**
 * Full synthesis: produce every project-level wiki page from scratch.
 * Single LLM call. Returns parsed pages.
 */
const SYNTHESIS_TIMEOUT_MS = 900_000;  // 15 min — single-call processes all wikis

export async function synthesizeFull({ repos, claudeOpts = {} }) {
  const userInput = buildSynthesisFullInput({ repos });
  const prompt = `${SYNTHESIS_PROMPT}\n\n--- INPUT ---\n${userInput}`;
  const res = await callClaude(prompt, { timeoutMs: SYNTHESIS_TIMEOUT_MS, ...claudeOpts });
  const parsed = parseSynthesisOutput(res.content);
  return { ...parsed, prompt, rawResponse: res.content, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
}

/**
 * Incremental synthesis: update only pages affected by changes in changedRepos.
 * Existing pages are passed for context; unchanged repos provide index only.
 * Model returns ONLY changed pages + DELETE markers.
 */
export async function synthesizeIncremental({ changedRepos, unchangedRepos, existingPages, claudeOpts = {} }) {
  const userInput = buildSynthesisIncrementalInput({ changedRepos, unchangedRepos, existingPages });
  const prompt = `${SYNTHESIS_PROMPT}\n\n--- INPUT ---\n${userInput}`;
  const res = await callClaude(prompt, { timeoutMs: SYNTHESIS_TIMEOUT_MS, ...claudeOpts });
  const parsed = parseSynthesisOutput(res.content);
  return { ...parsed, prompt, rawResponse: res.content, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
}
