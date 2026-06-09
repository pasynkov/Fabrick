const APP_PAGES = [
  { slug: 'service.md', title: 'Service Overview', focus: 'WHAT this app is: its purpose in 1–2 sentences, framework (NestJS / Express / etc.), deployment kind (worker / HTTP API / event-driven), replication / scaling traits (single instance / horizontal / leader-elected), and lifecycle (startup hooks, shutdown).' },
  { slug: 'contracts.md', title: 'External Contracts', focus: 'EVERY incoming / outgoing interface. List explicitly:\n- HTTP routes (method + path + brief purpose)\n- NATS subjects (subject + role: consumer / publisher / request-reply)\n- Kafka topics consumed / produced\n- gRPC services exposed\n- Outgoing calls to other services (request/reply target subjects, REST clients)\nUse exact identifiers from the source.' },
  { slug: 'config.md', title: 'Configuration', focus: 'Runtime configuration. Group by concern (Database / Messaging / Auth / Observability / Storage / Domain). Per item:\n- Environment variable name (exact, e.g. ASSETS_REGISTRY_POSTGRES_DATABASE)\n- Default value or fallback if present\n- One-line description of what it controls\nInclude ConfigMaps / Secrets referenced via envFrom if visible.' },
  { slug: 'integrations.md', title: 'External Integrations', focus: 'Every external system this app touches. One bullet per integration:\n- system kind (PostgreSQL / NATS cluster / GCS bucket / Kafka cluster / Redis / external HTTP API)\n- exact identifiers (database name, bucket name, broker host)\n- direction (reads / writes / both)\n- purpose (what data flows through)\nSkip internal shared libs (those are plumbing, not integrations).' },
];

export const APP_PAGE_SLUGS = APP_PAGES.map((p) => p.slug);

const FORMAT_HINT = 'Return ONLY the page sections in the format below. No code fences, no preamble, no JSON. Do not use any tools.';
const PAGE_BLOCK_SCHEMA = APP_PAGES.map((p) => `=== PAGE: ${p.slug} ===\n# ${p.title}\n<2-15 lines focused content>`).join('\n\n');
const PAGES_INSTRUCTIONS = APP_PAGES.map((p, i) => `${i + 1}. ${p.slug} — ${p.title}\n   FOCUS: ${p.focus}`).join('\n\n');

export function generateAppScopePrompt(opts: { scopeName: string; scopeKind: string; repoName: string; sources: Array<{ file: string; content: string }> }): { system: string; user: string } {
  const { scopeName, scopeKind, repoName, sources } = opts;
  const sourceBlocks = sources.map((s) => `[file: ${s.file}]\n${s.content}`).join('\n\n');
  const system = `You document one microservice scope inside a multi-service repository. Produce EXACTLY the 4 fixed pages below — no others, in order.

PAGES TO PRODUCE (all four, in this order):

${PAGES_INSTRUCTIONS}

GLOBAL RULES:
- Document EXTERNAL behavior only. Skip method bodies, helper functions, private classes.
- Every concrete claim must trace to the source code given below. Do not invent.
- Keep each page short and factual: 5–20 bullet points or 1–3 paragraphs.
- Use exact identifiers (NATS subject strings, env var names, route paths) verbatim.
- EVERY concrete claim MUST cite the source file as a relative-path markdown link.
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

export function patchAppScopePrompt(opts: { scopeName: string; scopeKind: string; repoName: string; existingPages: Record<string, string>; features: Array<{ kind: string; subject: string; details: string }> }): { system: string; user: string } {
  const { scopeName, scopeKind, repoName, existingPages, features } = opts;
  const existingBlock = APP_PAGES.map((p) => `--- existing ${p.slug} ---\n${existingPages[p.slug] ?? '(empty)'}`).join('\n\n');
  const featureBlock = (features ?? []).map((f, i) => `  [${i + 1}] (${f.kind}) ${f.subject}\n      ${f.details}`).join('\n\n');

  const system = `You update one microservice scope's 4-page wiki in response to a commit. Produce EXACTLY the 4 fixed pages — no others, in the same order.

PAGES TO MAINTAIN (all four, in this order):

${PAGES_INSTRUCTIONS}

GLOBAL RULES:
- The ESSENCE FEATURES are an authoritative summary of what changed in this commit.
- Apply ONLY changes described by features. Treat features as the diff truth.
- DO NOT REMOVE existing factual details that are unaffected by features.
- For sections unaffected by any feature, copy the existing body verbatim.

OUTPUT FORMAT (strict — emit exactly these markers):

${PAGE_BLOCK_SCHEMA}

${FORMAT_HINT}`;

  const user = `SCOPE: ${scopeName} (kind: ${scopeKind}) in repo "${repoName}"

EXISTING WIKI PAGES:
${existingBlock}

WHAT CHANGED (essence features — authoritative diff summary):
${featureBlock || '(no features — copy existing pages verbatim)'}
`;
  return { system, user };
}

export function parseAppPagesOutput(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  const re = /===\s*PAGE:\s*([^\s=]+)\s*===\s*\n?/g;
  const positions: Array<{ slug: string; contentStart: number; headerStart: number }> = [];
  let m;
  while ((m = re.exec(raw)) !== null) positions.push({ slug: m[1], contentStart: re.lastIndex, headerStart: m.index });
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    const next = positions[i + 1];
    out[p.slug] = raw.slice(p.contentStart, next ? next.headerStart : raw.length).trim();
  }
  return out;
}

export function describeChangePrompt(mode: string, slugLines: string, diffText: string): { system: string; user: string } {
  const system = `You write ONE short sentence (≤ 30 words) describing what changed in a documentation update. Read the symbol-level diff below: + means added bullet/row, - means removed, ~ means body changed. Mention specific identifiers (env var names, NATS subjects, image tags, replica counts) that moved. Avoid vague verbs like "updated" or "improved". Output ONLY the sentence, no preamble.`;
  const user = `Mode: ${mode}\nPer-slug counts: ${slugLines.replace(/\n/g, '  ')}\n\nSYMBOL-LEVEL DIFF:\n${diffText}`;
  return { system, user };
}
