import { query } from '@anthropic-ai/claude-agent-sdk';

const DEFAULT_MODEL = 'sonnet';
const DEFAULT_SYSTEM = 'You are a precise technical writer. Follow instructions exactly. Return only what is asked, no preamble.';

export async function callAgentSDK(prompt, {
  model = DEFAULT_MODEL,
  systemPrompt = DEFAULT_SYSTEM,
  maxTurns = 1,
} = {}) {
  const t0 = Date.now();
  const options = {
    model,
    allowedTools: [],
    disallowedTools: ['*'],
    maxTurns,
    settingSources: [],
    systemPrompt,
    settings: { enabledPlugins: { 'caveman@caveman': false }, mcpServers: {} },
  };

  let result = null;
  for await (const msg of query({ prompt, options })) {
    if (msg.type === 'result') { result = msg; break; }
  }
  const wallMs = Date.now() - t0;
  if (!result) throw new Error('Agent SDK returned no result message');
  if (result.is_error) throw new Error(`Agent SDK error: subtype=${result.subtype} raw=${JSON.stringify(result).slice(0, 500)}`);
  return {
    content: result.result,
    usage: result.usage,
    costUsd: result.total_cost_usd,
    durationMs: result.duration_ms,
    wallMs,
    sessionId: result.session_id,
    raw: result,
  };
}
