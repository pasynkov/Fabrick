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

export function bootstrapRoutingRulesPrompt({ repoName, summary, sampleSymbols, rootFiles = {} }) {
  const sampleBlock = sampleSymbols.slice(0, 20).map((s) =>
    `[${s.kind}] ${s.name}\n  file: ${s.file}\n  signature: ${trim(s.signature ?? '', 240)}\n  imports: ${(s.imports ?? []).slice(0, 8).join(', ')}`
  ).join('\n\n');

  const rootFilesBlock = Object.entries(rootFiles)
    .map(([name, content]) => `=== ${name} ===\n${content}`)
    .join('\n\n');

  const system = `You are bootstrapping documentation-routing rules for a code repository. The downstream pipeline maintains a 4-page wiki per microservice; your job is to teach that pipeline which signals in the codebase route to which page.

WIKI PAGES (fixed slugs; routing must target these):
${SLUG_DEFINITIONS}

INPUT YOU WILL RECEIVE:
- summary.json — counts and top-N tables (decorators/annotations, imports, file paths, symbol kinds), plus decoratorMatrix, topLevelDirs, rootFileNames
- root files — verbatim contents of project-manifest / README / Dockerfile / build configs at the repo root
- 20 sample symbols — full shape (signature with decorators, imports, file)

INFER, FROM THE INPUT ONLY:
1. INTERNAL libraries vs EXTERNAL integrations.
   Internal = code authored inside this repo or its scoped sibling projects (high reuse count,
   project-prefixed module paths, relative paths into the repo). External = third-party SDKs
   that talk to systems outside the process.

2. Per slug, which decorators / annotations are STRONG signals for that slug.
   USE THE decoratorMatrix in the summary. Each decorator shows:
     - count: total occurrences
     - filePatterns: where the decorator actually appears (file glob, count)
     - coImports: which imports co-occur on the same symbol
   A decorator qualifies as a slug signal ONLY IF ALL of:
     a) count >= 5  (rare decorators are unreliable — a single new file flips them)
     b) >= 80% of uses concentrate in ONE file pattern that maps to one slug,
        OR it always co-imports a slug-specific external library
        (e.g. always with typeorm → integrations; always with @nestjs/microservices → contracts).
   Decorators that fail either bar — generic helpers like class-validator's IsString/IsInt/
   IsArray/ValidateNested/Type that happen to appear only in config classes because this
   project doesn't have validated DTOs — MUST be EXCLUDED. They are not robust slug signals;
   the next commit could legitimately use them elsewhere. Rely on filePatterns instead.

   POSITIVE EXAMPLE:
     @Injectable count=13, 85% in *.service.ts → INCLUDE under "service"
     @Module     count=13, 100% in *.module.ts → INCLUDE under "service"
     @Entity     count=6,  100% in *.entity.ts always with typeorm → INCLUDE under "integrations"
   NEGATIVE EXAMPLE:
     @IsString   count=33, 70% *.config.ts / 30% *.contract.ts → EXCLUDE (scattered)
     @IsNotEmpty count=6,  100% *.config.ts but it is a class-validator helper used wherever
                 validation is needed → EXCLUDE (generic, fragile)
     @InjectRepository count=2 → EXCLUDE (count too low)

3. Per slug, which IMPORT paths are direct evidence of the slug
   (e.g. an external DB driver import means the file deals with an external integration).

4. File-name patterns that strongly suggest a slug. THIS IS THE PRIMARY signal when decorators
   are ambiguous. List patterns visible in the topFiles + decoratorMatrix.filePatterns.

DO NOT INVENT:
- Only emit decorators/imports/paths that actually appear in the input.
- If a slug has no matching signal, return an empty list — do not guess.

OUTPUT SHAPE (fill from the input):

{
  "repoName": "<from input>",
  "project": {
    "language":   "<primary language(s), e.g. TypeScript, Python, Go>",
    "framework":  "<primary application framework, e.g. NestJS, FastAPI, Spring Boot>",
    "kind":       "<one of: service | monorepo | library | gitops | infrastructure | unknown>",
    "runCommands": ["<short command, e.g. npm run start:vision-connector>", ...],
    "buildCommands": ["<build entry from manifest, e.g. npm run build>", ...],
    "apps": [                              // populate ONLY if monorepo
      { "name": "<app name>", "root": "<path>", "entry": "<entry file or null>" }
    ],
    "summary":    "<1-3 sentence project description suitable for README header>"
  },
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

ROOT FILES (verbatim, truncated to 8KB each):
${rootFilesBlock || '(no root files captured)'}

SAMPLE SYMBOLS (20 random, full shape):
${sampleBlock}
`;

  return { system, user };
}

function trim(s, n) { return s.length > n ? s.slice(0, n - 3) + '...' : s; }
