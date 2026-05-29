'use strict';

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const yaml = require('yaml');

const API_URL = process.env.SANDBOX_API_URL || 'http://localhost:3001';
const ORG = process.env.SANDBOX_ORG || 'sandbox';
const PROJECT = process.env.SANDBOX_PROJECT || 'sandbox';

function loadQueries(file) {
  const raw = fs.readFileSync(file, 'utf-8');
  const parsed = yaml.parse(raw);

  let defaults = {};
  let list = null;

  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.queries)) {
    list = parsed.queries;
    if (parsed.defaults && typeof parsed.defaults === 'object') defaults = parsed.defaults;
  }
  if (!list) throw new Error('YAML must be an array, or { defaults?: {...}, queries: [...] }');

  const defaultReasoning = defaults.reasoning === true;

  return list.map((item) => {
    if (typeof item === 'string') {
      return { name: item, question: item, reasoning: defaultReasoning };
    }
    const reasoning = typeof item.reasoning === 'boolean' ? item.reasoning : defaultReasoning;
    return {
      name: item.name || item.question,
      question: item.question,
      reasoning,
    };
  });
}

async function ask(question, reasoning) {
  const url = `${API_URL}/v1/orgs/${ORG}/projects/${PROJECT}/search`;
  const t0 = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, reasoning }),
  });
  const dt = Date.now() - t0;
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, body: text, ms: dt };
  }
  try {
    return { ok: true, body: JSON.parse(text), ms: dt };
  } catch {
    return { ok: true, body: text, ms: dt };
  }
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/search.js <queries.yaml>');
    process.exit(1);
  }
  const absPath = path.resolve(file);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const queries = loadQueries(absPath);
  console.log(`Loaded ${queries.length} queries from ${absPath}`);
  console.log(`Target: ${API_URL}/v1/orgs/${ORG}/projects/${PROJECT}/search\n`);

  const results = [];
  for (let i = 0; i < queries.length; i++) {
    const { name, question, reasoning } = queries[i];
    console.log('━'.repeat(70));
    console.log(`[${i + 1}/${queries.length}] ${name}  reasoning=${reasoning}`);
    console.log(`Q: ${question}`);
    const r = await ask(question, reasoning);
    if (!r.ok) {
      console.error(`! HTTP ${r.status} (${r.ms}ms): ${r.body}`);
      results.push({ name, question, reasoning, error: `HTTP ${r.status}`, body: r.body, ms: r.ms });
      continue;
    }
    const { answer, reasoning: reasoningText, sources, metrics } = r.body;
    console.log(`Sources (${(sources || []).length}): ${(sources || []).join(', ')}`);
    if (metrics) {
      const totalTokens = (metrics.totalInputTokens || 0) + (metrics.totalOutputTokens || 0);
      console.log(`Server metrics: iters=${metrics.iters}  totalTokens=${totalTokens}  durationMs=${metrics.durationMs}`);
    }
    console.log(`Local latency: ${r.ms}ms`);
    console.log(`\nA:\n${answer}\n`);
    if (reasoningText) {
      console.log(`Reasoning:\n${reasoningText}\n`);
    }
    results.push({ name, question, reasoning, answer, reasoningText, sources, metrics, ms: r.ms });
  }

  const outDir = path.join(__dirname, '..', 'sandbox-data');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `search-results-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log('━'.repeat(70));
  console.log(`Wrote ${results.length} results → ${outPath}`);
}

main().catch((err) => {
  console.error('search failed:', err && err.message ? err.message : err);
  if (err && err.cause) console.error('cause:', err.cause);
  process.exit(1);
});
