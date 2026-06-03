import { callClaude } from './cli.js';
import { validatorPrompt } from './prompts.js';

export async function validatePatches({ narrative, pages, claudeOpts = {} }) {
  const prompt = validatorPrompt({ narrative, pages });
  const res = await callClaude(prompt, claudeOpts);
  const json = extractJsonObject(res.content);
  if (!json) {
    return { landed: [], missing: [], score: null, raw: res.content, usage: res.usage, costUsd: res.costUsd };
  }
  return { ...json, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
}

function extractJsonObject(text) {
  if (!text) return null;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenceMatch ? fenceMatch[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(body.slice(start, end + 1)); }
  catch { return null; }
}
