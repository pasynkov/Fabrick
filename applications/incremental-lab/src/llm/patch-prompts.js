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
 */
export function computePatchPrompt({
  scopeName, scopeKind, repoName,
  existingPages, unifiedDiff = '', changedFileContents = {},
}) {
  const existingBlock = APP_PAGES.map((p) =>
    `--- ${p.slug} ---\n${existingPages[p.slug] ?? '(empty)'}`
  ).join('\n\n');

  const changedFilesBlock = Object.entries(changedFileContents)
    .map(([file, content]) => `[file: ${file}]\n${content}`)
    .join('\n\n');

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

UNIFIED SOURCE DIFF (authoritative — every change is here):
\`\`\`diff
${unifiedDiff || '(no diff supplied)'}
\`\`\`

${changedFilesBlock ? `CURRENT CONTENT OF CHANGED FILES (for context):\n${changedFilesBlock}\n` : ''}`;

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
