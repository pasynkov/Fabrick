/**
 * Bootstrap project-specific routing rules from a tree-sitter snapshot summary.
 * Run ONCE per repo. Output is a JSON artifact that the per-commit patcher
 * consumes to route source-code changes to wiki page slugs.
 *
 * The prompt is language- and framework-agnostic: it describes only the
 * downstream slugs and lets the model infer everything from the snapshot.
 */

const FORMAT_HINT = `Return ONLY the JSON object. No markdown fences, no preamble. Do not use any tools.`;

const SLUG_DEFINITIONS = `
- service.md      WHAT the service is: identity, framework, deployment kind, lifecycle, replication.
- contracts.md    Interfaces this service EXPOSES or CONSUMES at the message/transport boundary.
                  (HTTP routes, message-broker subscriptions, gRPC endpoints, queue handlers, etc.)
- config.md       Runtime configuration the service reads: env vars, config sections, secrets.
- integrations.md External SYSTEMS the service talks to (databases, brokers, cloud APIs, HTTP servers).
                  This is NOT the same as project-internal shared libraries — those should be ignored.
`.trim();

export function bootstrapRoutingRulesPrompt({ repoName, summary, sampleSymbols }) {
  const sampleBlock = sampleSymbols.slice(0, 20).map((s) =>
    `[${s.kind}] ${s.name}\n  file: ${s.file}\n  signature: ${trim(s.signature ?? '', 240)}\n  imports: ${(s.imports ?? []).slice(0, 8).join(', ')}`
  ).join('\n\n');

  const system = `You are bootstrapping documentation-routing rules for a code repository. The downstream pipeline maintains a 4-page wiki per microservice; your job is to teach that pipeline which signals in the codebase route to which page.

WIKI PAGES (fixed slugs; routing must target these):
${SLUG_DEFINITIONS}

INPUT YOU WILL RECEIVE:
- summary.json — counts and top-N tables (decorators/annotations, imports, file paths, symbol kinds)
- 20 sample symbols — full shape (signature with decorators, imports, file)

INFER, FROM THE INPUT ONLY:
1. INTERNAL libraries vs EXTERNAL integrations.
   Internal = code authored inside this repo or its scoped sibling projects (high reuse count,
   project-prefixed module paths, relative paths into the repo). External = third-party SDKs
   that talk to systems outside the process.

2. Per slug, which decorators / annotations consistently mark code that documents that slug.
   Read the signatures. If a decorator appears mostly on classes/methods that look like incoming
   message handlers, it goes under "contracts". If it appears on classes holding validated env-var
   fields, it goes under "config". And so on.

3. Per slug, which IMPORT paths indicate the slug. (e.g. an external DB driver import means
   the file deals with an external integration.)

4. File-name patterns that strongly suggest a slug.

DO NOT INVENT:
- Only emit decorators/imports/paths that actually appear in the input.
- If a slug has no matching signal, return an empty list — do not guess.

OUTPUT SHAPE (fill from the input):

{
  "repoName": "<from input>",
  "frameworks": ["<frameworks inferred from imports/decorators, may be empty>"],
  "internalLibs": ["<import path prefix>", ...],
  "decorators": {
    "service":     ["<decorator name>", ...],
    "contracts":   ["<decorator name>", ...],
    "config":      ["<decorator name>", ...],
    "integrations":["<decorator name>", ...]
  },
  "imports": {
    "service":      ["<import path>", ...],
    "contracts":    ["<import path>", ...],
    "config":       ["<import path>", ...],
    "integrations": { "<import path>": "<short human label>", ... }
  },
  "filePatterns": {
    "<glob pattern>": ["<slug>", "<slug>", ...]
  },
  "notes": "1-3 short observations about THIS project that future routing should respect"
}

${FORMAT_HINT}`;

  const user = `REPO: ${repoName}

SNAPSHOT SUMMARY:
${JSON.stringify(summary, null, 2)}

SAMPLE SYMBOLS (20 random, full shape):
${sampleBlock}
`;

  return { system, user };
}

function trim(s, n) { return s.length > n ? s.slice(0, n - 3) + '...' : s; }
