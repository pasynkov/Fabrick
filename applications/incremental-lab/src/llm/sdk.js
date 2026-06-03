import Anthropic from '@anthropic-ai/sdk';

const MODEL_ALIAS = {
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5',
  opus: 'claude-opus-4-7',
};

const PRICING = {
  'claude-sonnet-4-6': { input: 3, output: 15, cacheWrite5m: 3.75, cacheRead: 0.30 },
  'claude-haiku-4-5':  { input: 1, output: 5,  cacheWrite5m: 1.25, cacheRead: 0.10 },
  'claude-opus-4-7':   { input: 15, output: 75, cacheWrite5m: 18.75, cacheRead: 1.50 },
};

let _client = null;
function getClient() {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY ?? '';
  if (!key.startsWith('sk-ant-api03-')) {
    throw new Error(
      `SDK requires a sk-ant-api03-* key from console.anthropic.com. ` +
      `OAuth subscription tokens (sk-ant-oat01-*) are not accepted on the direct Messages API ` +
      `as of Feb 2026 — use the CLI transport for subscription auth.`,
    );
  }
  _client = new Anthropic({ apiKey: key });
  return _client;
}

function priceCost(model, usage) {
  const p = PRICING[model];
  if (!p) return 0;
  const inputT = usage.input_tokens ?? 0;
  const cwT = usage.cache_creation_input_tokens ?? 0;
  const crT = usage.cache_read_input_tokens ?? 0;
  const outT = usage.output_tokens ?? 0;
  return (inputT * p.input + cwT * p.cacheWrite5m + crT * p.cacheRead + outT * p.output) / 1_000_000;
}

export async function callSDK({ system, user, model = 'sonnet', maxTokens = 4096 }) {
  const resolved = MODEL_ALIAS[model] ?? model;
  const systemBlocks = Array.isArray(system) ? system : (system ? [{ type: 'text', text: system }] : []);
  const t0 = Date.now();
  const res = await getClient().messages.create({
    model: resolved,
    max_tokens: maxTokens,
    system: systemBlocks.length ? systemBlocks : undefined,
    messages: [{ role: 'user', content: user }],
  });
  const wallMs = Date.now() - t0;
  const content = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  return {
    content,
    usage: res.usage,
    costUsd: priceCost(resolved, res.usage),
    wallMs,
    model: resolved,
  };
}

export async function callSDKWithCache({ systemStatic, systemDynamic = '', user, model = 'sonnet', maxTokens = 4096 }) {
  const blocks = [];
  if (systemStatic) blocks.push({ type: 'text', text: systemStatic, cache_control: { type: 'ephemeral' } });
  if (systemDynamic) blocks.push({ type: 'text', text: systemDynamic });
  return callSDK({ system: blocks, user, model, maxTokens });
}
