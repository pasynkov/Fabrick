'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const API_URL = process.env.SANDBOX_API_URL || 'http://localhost:3001';

async function main() {
  const repos = (process.env.REPOS || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (repos.length === 0) {
    console.error('REPOS not set (.env). Expected comma-separated absolute paths.');
    process.exit(1);
  }

  console.log(`POST ${API_URL}/v1/sandbox/synthesize`);
  console.log(`Repos: ${repos.join(', ')}`);

  const t0 = Date.now();
  const res = await fetch(`${API_URL}/v1/sandbox/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repos }),
  });
  const dt = Date.now() - t0;
  const text = await res.text();

  if (!res.ok) {
    console.error(`HTTP ${res.status} ${res.statusText} (${dt}ms)`);
    console.error(text);
    process.exit(2);
  }

  try {
    const json = JSON.parse(text);
    console.log(`OK (${dt}ms): ${JSON.stringify(json)}`);
  } catch {
    console.log(`OK (${dt}ms): ${text}`);
  }
}

main().catch((err) => {
  console.error('synth failed:', err && err.message ? err.message : err);
  if (err && err.cause) console.error('cause:', err.cause);
  process.exit(1);
});
