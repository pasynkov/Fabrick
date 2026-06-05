/**
 * Two-phase patch model.
 *
 * COMPUTE (dev-side, expensive): sees full source diff + existing pages,
 *   produces a thorough per-page patch document describing exactly what to
 *   change. Patch is a human-readable artifact (audit trail).
 *
 * APPLY (SDK-side, cheap): takes the patch + existing pages, applies the
 *   instructions, emits new pages. No source, no diff, no inference.
 */

import { APP_PAGES } from '../wiki/app-taxonomy.js';

const FORMAT_HINT = `Return ONLY the patch sections. No code fences, no preamble. Do not use any tools.`;

const PAGE_LIST = APP_PAGES.map((p) => `${p.slug} — ${p.title} (${p.focus.split('\n')[0]})`).join('\n');

const PATCH_BLOCK_SCHEMA = APP_PAGES.map((p) =>
  `=== PATCH: ${p.slug} ===\n<instructions OR "no changes">`
).join('\n\n');

/**
 * Build a compute-patch prompt. Output is a patch document, NOT new pages.
 * Unified diff is the sole source-of-truth for what changed; we no longer
 * include full file contents (the diff already encodes both sides).
 */
export function computePatchPrompt({
  scopeName, scopeKind, repoName,
  existingPages, unifiedDiff = '',
}) {
  const existingBlock = APP_PAGES.map((p) =>
    `--- ${p.slug} ---\n${existingPages[p.slug] ?? '(empty)'}`
  ).join('\n\n');

  const system = `You compute a detailed patch for a microservice scope's 4-page wiki.

Your job: given the unified source diff and the existing wiki pages, decide WHAT each page needs to change and produce a patch document. You are NOT writing the new pages — you are writing instructions another model will execute.

PAGES TO PATCH:
${PAGE_LIST}

PATCH RULES:
- For each of the 4 pages, decide whether it needs updates.
- If a page is unaffected by this commit, emit exactly: "no changes"
- Otherwise emit a numbered list of concrete instructions. Each instruction:
  * names the target (section, bullet, sentence) clearly so it can be located in the existing page
  * states the exact new content (verbatim values, identifiers, numbers from source)
  * is independent and minimal — touch only what changed; do not rewrite paragraphs that are still accurate
- Preserve all existing factual detail that is still true. Do not delete unaffected bullets.
- Use exact identifiers from source (env var names, NATS subjects, image tags, replica counts, probe timings).
- EVERY new factual claim MUST cite the source file as a relative-path markdown link, e.g. \`[onGet()](src/vision-connector/vision-connector.controller.ts)\` or \`[REAPER_GCP_BUCKET_NAME](src/config/reaper.config.ts)\`. The link path is scope-relative (read the diff file headers — drop the scope-root prefix). When an instruction modifies an EXISTING bullet, preserve any existing links and ADD new ones for the newly-cited symbols.
- Skip method-body refactors and internal class noise.

INSTRUCTION VOCABULARY (use these verbs):
- REPLACE <target> WITH: <new text>
- ADD UNDER <section heading or list>: <new bullet/paragraph>
- REMOVE <target>
- RENAME <old identifier> TO <new identifier> (throughout page)

OUTPUT FORMAT (emit exactly these 4 sections in this order):

${PATCH_BLOCK_SCHEMA}

${FORMAT_HINT}`;

  const user = `SCOPE: ${scopeName} (kind: ${scopeKind}) in repo "${repoName}"

EXISTING WIKI PAGES:
${existingBlock}

UNIFIED SOURCE DIFF (authoritative — every change is here; both before and after are present):
\`\`\`diff
${unifiedDiff || '(no diff supplied)'}
\`\`\`
`;

  return { system, user };
}

/**
 * Per-slug compute prompt: ONE wiki page + ONLY the diff hunks for files
 * routed to this slug. Much smaller than the all-pages variant; safer because
 * the model can't bleed cross-slug content into the wrong page.
 */
export function computeSlugPatchPrompt({ scopeName, scopeKind, repoName, slug, slugTitle, slugFocus, existingPage, slugDiff, otherPages = {} }) {
  const otherBlock = Object.entries(otherPages)
    .filter(([s]) => s !== slug)
    .map(([s, body]) => `--- ${s} (read-only context) ---\n${body ?? '(empty)'}`)
    .join('\n\n');

  const system = `You compute a detailed patch for ONE wiki page of a microservice scope.

YOUR TARGET PAGE: ${slug} — ${slugTitle}
FOCUS: ${slugFocus}

You will also see the OTHER 3 pages in this scope as read-only context. They show what is already documented elsewhere — do NOT duplicate content into ${slug} that another page already covers.

PATCH RULES:
- Read the unified diff. Decide what the diff means for ${slug} specifically (not for the other pages).
- If the diff has NO content that would change ${slug}, emit exactly: "no changes"
- Otherwise emit a numbered list of concrete instructions. Each instruction:
  * names the target (section, bullet, sentence) so it can be located in the existing ${slug}
  * states the exact new content (verbatim identifiers, numbers, names from source)
  * is independent and minimal
- ANY of these belong on ${slug} (be liberal — err on the side of patching):
  * New external dependency added (new SDK import, new service connection) → service/integrations
  * Env var added/removed/renamed → config
  * Endpoint added/changed/removed → contracts
  * Lifecycle hook added (OnApplicationShutdown, etc.) → service
  * New deployment-relevant trait (image, replicas, probe, strategy) → service
- Preserve all existing factual detail. Do not delete unaffected bullets.
- Use exact identifiers from source verbatim.

INSTRUCTION VOCABULARY:
- REPLACE <target> WITH: <new text>
- ADD UNDER <section heading or list>: <new bullet/paragraph>
- REMOVE <target>
- RENAME <old identifier> TO <new identifier>

OUTPUT FORMAT (emit exactly one section):

=== PATCH: ${slug} ===
<instructions OR "no changes">

Return ONLY the patch section. No code fences, no preamble. Do not use any tools.`;

  const user = `SCOPE: ${scopeName} (kind: ${scopeKind}) in repo "${repoName}"

EXISTING ${slug} (your target):
${existingPage ?? '(empty)'}

${otherBlock ? `OTHER PAGES IN THIS SCOPE (read-only, do not duplicate):\n${otherBlock}\n\n` : ''}UNIFIED DIFF (files in this scope; routed primarily to ${slug}):
\`\`\`diff
${slugDiff || '(no diff)'}
\`\`\`
`;

  return { system, user };
}

/**
 * Build an apply-patch prompt. No diff, no source — just patch + existing
 * bodies of ONLY the pages that need to change. Unchanged pages are not in
 * the prompt and not in the output (caller carries them forward verbatim).
 */
export function applyPatchPrompt({ scopeName, scopeKind, repoName, existingPages, patchBySlug, slugsToApply }) {
  const existingBlock = slugsToApply.map((slug) =>
    `--- existing ${slug} ---\n${existingPages[slug] ?? '(empty)'}`
  ).join('\n\n');

  const patchBlock = slugsToApply.map((slug) =>
    `=== PATCH: ${slug} ===\n${patchBySlug[slug] ?? ''}`
  ).join('\n\n');

  const PAGE_BLOCK_SCHEMA = slugsToApply.map((slug) => {
    const title = APP_PAGES.find((p) => p.slug === slug)?.title ?? slug;
    return `=== PAGE: ${slug} ===\n# ${title}\n<full page body after applying patch>`;
  }).join('\n\n');

  const system = `You apply a pre-computed patch to ${slugsToApply.length} wiki page(s). The patch tells you exactly what to change; you execute it.

RULES:
- For each page, apply the instructions in its patch section verbatim.
- Do NOT introduce facts not present in the existing page or the patch instructions.
- Do NOT remove existing content unless the patch explicitly says REMOVE.
- Keep formatting (markdown headings, bullet style) consistent with the existing page.
- PRESERVE every markdown source-file link present in the existing page or the patch instructions. If the patch adds new identifiers, keep the new \`[name](path)\` link the patch supplies — do not strip parentheses or convert links to plain text.

OUTPUT FORMAT (emit exactly these ${slugsToApply.length} page section(s) in order, full body each):

${PAGE_BLOCK_SCHEMA}

Return ONLY the page sections. No code fences, no preamble. Do not use any tools.`;

  const user = `SCOPE: ${scopeName} (kind: ${scopeKind}) in repo "${repoName}"

EXISTING WIKI PAGES (only those with patches):
${existingBlock}

PATCHES TO APPLY:
${patchBlock}
`;

  return { system, user };
}

/**
 * Parse the compute-patch output into { slug: instructions }.
 */
export function parsePatchOutput(raw) {
  const out = {};
  if (!raw) return out;
  const re = /===\s*PATCH:\s*([^\s=]+)\s*===\s*\n?/g;
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
