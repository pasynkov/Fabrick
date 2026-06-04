import { APP_PAGES } from '../wiki/app-taxonomy.js';

const FORMAT_HINT = `Return ONLY the page sections in the format below. No code fences, no preamble, no JSON. Do not use any tools.`;

const PAGE_BLOCK_SCHEMA = APP_PAGES.map((p) =>
  `=== PAGE: ${p.slug} ===\n# ${p.title}\n<2-15 lines focused content>`
).join('\n\n');

const PAGES_INSTRUCTIONS = APP_PAGES.map((p, i) =>
  `${i + 1}. ${p.slug} — ${p.title}\n   FOCUS: ${p.focus}`
).join('\n\n');

/**
 * Single-call generator for ALL 4 pages of an app scope.
 *
 * Returns { system, user } so the (large, static) instructions can be cached
 * across parallel scope calls.
 */
export function generateAppScopePrompt({ scopeName, scopeKind, repoName, sources }) {
  const sourceBlocks = sources.map((s) => `[file: ${s.file}]\n${s.content}`).join('\n\n');

  const system = `You document one microservice scope inside a multi-service repository. Produce EXACTLY the 4 fixed pages below — no others, in order.

PAGES TO PRODUCE (all four, in this order):

${PAGES_INSTRUCTIONS}

GLOBAL RULES:
- Document EXTERNAL behavior only. Skip method bodies, helper functions, private classes.
- Every concrete claim must trace to the source code given below. Do not invent.
- Keep each page short and factual: 5–20 bullet points or 1–3 paragraphs.
- Use exact identifiers (NATS subject strings, env var names, route paths) verbatim.
- Cite source files in parens when helpful: "POSTGRES_HOST (sentinel/config/configs/postgres.config.ts)".
- Do NOT write a "## Related" section — it is auto-generated.

OUTPUT FORMAT (strict — emit exactly these markers):

${PAGE_BLOCK_SCHEMA}

${FORMAT_HINT}`;

  const user = `SCOPE: ${scopeName} (kind: ${scopeKind}) in repo "${repoName}"

SOURCE CODE:
${sourceBlocks}
`;

  return { system, user };
}

/**
 * Single-call patcher for the same 4 pages, given existing bodies + an essence
 * summary of what changed in the scope.
 */
export function patchAppScopePrompt({ scopeName, scopeKind, repoName, existingPages, features, sources }) {
  const existingBlock = APP_PAGES.map((p) =>
    `--- existing ${p.slug} ---\n${existingPages[p.slug] ?? '(empty)'}`
  ).join('\n\n');

  const featureBlock = (features ?? []).map((f, i) =>
    `  [${i + 1}] (${f.kind}) ${f.subject}\n      ${f.details}`
  ).join('\n\n');

  const sourceBlocks = sources.map((s) => `[file: ${s.file}]\n${s.content}`).join('\n\n');

  const system = `You update one microservice scope's 4-page wiki in response to a commit. Produce EXACTLY the 4 fixed pages — no others, in the same order.

PAGES TO MAINTAIN (all four, in this order):

${PAGES_INSTRUCTIONS}

GLOBAL RULES:
- The CURRENT SOURCE CODE is the source of truth. Existing pages may be stale.
- Verify every concrete claim against the source. Update counts, lists, names.
- DO NOT REMOVE existing factual details that are still accurate. Add new, preserve old.
- For sections still accurate, keep wording close to existing to minimize churn.
- Use exact identifiers from source (NATS subject strings, env var names, route paths).
- Skip method internals; document only external/interface-level concerns.
- Do NOT write a "## Related" section — it is auto-generated.

OUTPUT FORMAT (strict — emit exactly these markers):

${PAGE_BLOCK_SCHEMA}

${FORMAT_HINT}`;

  const user = `SCOPE: ${scopeName} (kind: ${scopeKind}) in repo "${repoName}"

EXISTING WIKI PAGES (may be stale):
${existingBlock}

WHAT CHANGED (essence features):
${featureBlock || '(no essence features; rely on source code diff)'}

CURRENT SOURCE CODE:
${sourceBlocks}
`;

  return { system, user };
}

/**
 * Parse the model output into a map { slug: body }.
 */
export function parseAppPagesOutput(raw) {
  const out = {};
  if (!raw) return out;
  const re = /===\s*PAGE:\s*([^\s=]+)\s*===\s*\n?/g;
  const positions = [];
  let m;
  while ((m = re.exec(raw)) !== null) positions.push({ slug: m[1], contentStart: re.lastIndex, headerStart: m.index });
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    const next = positions[i + 1];
    out[p.slug] = raw.slice(p.contentStart, next ? next.headerStart : raw.length).trim();
  }
  return out;
}
