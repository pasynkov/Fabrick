import { callClaude } from './cli.js';
import { judgePrompt } from './prompts.js';

export async function judge({ pageA, pageB, context = '', claudeOpts = {} }) {
  const prompt = judgePrompt({ pageA, pageB, context });
  const res = await callClaude(prompt, claudeOpts);
  const json = extractJsonObject(res.content);
  if (!json) {
    throw new Error(`judge returned non-JSON output:\n${res.content.slice(0, 400)}`);
  }
  return { ...json, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs, raw: res.content };
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
