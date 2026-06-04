const FORMAT_HINT = `Return ONLY the markdown content. No \`\`\`markdown fences, no preamble, no explanation. Do not use any tools — all the source code you need is in this prompt.`;

const TAXONOMY_HINT = `Wiki taxonomy (production fabrick-analyze convention):
- entities/  domain models, data structures, DB schemas, k8s resources
- logic/     business flows, algorithms, processes (top-level functions)
- contracts/ API endpoints, request/response schemas, shared interfaces
- transport/ messaging topics/events, queues, gRPC, NATS subjects
- config/    environment variables and module-level configuration

The PAGE SLUG above already reflects the chosen category — write content that belongs in that category.`;

export function generatePagePrompt({ slug, symbols, sources }) {
  const symbolList = symbols.map((s) => `  - ${s.id} (${s.kind})`).join('\n');
  const sourceBlocks = sources.map((s) => `[file: ${s.file}]\n${s.content}`).join('\n\n');

  return `You are a technical writer producing a concise wiki page for a code symbol.

PAGE SLUG: ${slug}

SYMBOLS DOCUMENTED ON THIS PAGE:
${symbolList}

SOURCE CODE:
${sourceBlocks}

${TAXONOMY_HINT}

INSTRUCTIONS:
- Start with a level-1 heading using the primary symbol's name.
- Write a 1-2 paragraph description of what this symbol is and what it does.
- Add a "## Symbols" section listing each documented symbol with one-line description.
- If the code has non-obvious behavior, add a "## Notes" section. Skip if not needed.
- Do NOT write a "## Related" section — it is auto-generated from the code graph.
- Keep it short and factual. No marketing language.

${FORMAT_HINT}
`;
}

/**
 * Essence-driven patcher: existing page + a curated list of feature items
 * relevant to THIS page (filtered by the coordinator). No raw source files —
 * essence items already extracted the relevant facts.
 *
 * Returns { system, user } so the static instructions/taxonomy/format can
 * land in the system block (auto-cached by Anthropic across subagent calls)
 * while only the per-page dynamic content lives in the user block.
 */
export function patchPageFromEssencePrompt({ slug, existingPage, features, currentSignatures }) {
  const featureBlock = features.map((f, i) =>
    `  [${i + 1}] (${f.kind}) ${f.subject}\n      ${f.details}`
  ).join('\n\n');

  const system = `You are a service-architecture documentarian. You update one page of a project wiki using a curated list of features extracted from the latest commit.

SCOPE — what to document:
- Incoming/outgoing requests (HTTP routes, NATS subjects, gRPC, queues)
- Service shape (framework, deployment kind, scaling characteristics)
- Business behavior (returns what from where, what data transformation happens, side effects)
- Cross-service dependencies (which services / databases / queues it touches)

OUT OF SCOPE — do NOT document:
- Method implementation details, control flow, helper logic
- Private helpers, internal data structures
- Method bodies (only their public signature matters when relevant)

${TAXONOMY_HINT}

INSTRUCTIONS:
- Apply each feature in FEATURES TO APPLY to the existing page. Features ARE the source of truth.
- For added-feature / modified-behavior: update the relevant section, focused on interface or business outcome.
- For deletion: remove mentions of the deleted symbol.
- For signature-change: update parameter/return descriptions to match.
- For config-change: update env vars / config sections.
- DO NOT REMOVE existing factual details that are still accurate. Add new, preserve old.
- For sections still accurate, keep wording close to existing to minimize churn.
- Do NOT write a "## Related" section — it is auto-generated.

${FORMAT_HINT}`;

  const user = `PAGE SLUG: ${slug}

EXISTING PAGE CONTENT:
---
${existingPage}
---

FEATURES TO APPLY (already filtered for this page):
${featureBlock || '(none relevant — no-op expected)'}

CURRENT SIGNATURES OF SYMBOLS ON THIS PAGE:
${currentSignatures}
`;

  return { system, user };
}

export function patchPagePromptSlim({ slug, existingPage, changeContext, currentSignatures }) {
  return `You are a technical writer maintaining a wiki page. Update minimally — preserve structure and tone, only edit what the code changes require.

PAGE SLUG: ${slug}

EXISTING PAGE CONTENT:
---
${existingPage}
---

WHAT CHANGED IN THE CODE:
${changeContext || '(no symbol-level changes detected on this page; consumer cascade only)'}

CURRENT SYMBOLS ON THIS PAGE (with their signatures):
${currentSignatures}

INSTRUCTIONS:
- Update the existing page in place. Preserve sections that are still accurate.
- Edit only the parts affected by the changes listed above.
- For ADDED symbols: add a brief documentation entry consistent with the existing format.
- For REMOVED symbols: remove their mentions.
- For SIGNATURE CHANGED: update parameter/return descriptions to match.
- For BODY CHANGED: if you cannot tell what changed without seeing the body, keep the existing description.
- Do not invent details you cannot infer from signatures.
- Do NOT write a "## Related" section — it is auto-generated from the code graph.

${FORMAT_HINT}
`;
}

export function patchPagePrompt({ slug, existingPage, changes, symbols, sources, referencesBlock = '' }) {
  const changeList = changes.map((c) => `  - ${c}`).join('\n');
  const symbolList = symbols.map((s) => `  - ${s.id} (${s.kind})`).join('\n');
  const sourceBlocks = sources.map((s) => `[file: ${s.file}]\n${s.content}`).join('\n\n');
  const referencesSection = referencesBlock ? `\n\n${referencesBlock}` : '';

  return `You are a technical writer maintaining a wiki page. Update minimally — preserve structure and tone, only change what the code changes require.

PAGE SLUG: ${slug}

EXISTING PAGE CONTENT:
---
${existingPage}
---

CHANGES TO REFLECT:
${changeList}

CURRENT SYMBOLS ON THIS PAGE:
${symbolList}${referencesSection}

CURRENT SOURCE CODE:
${sourceBlocks}

${TAXONOMY_HINT}

INSTRUCTIONS:
- The CURRENT SOURCE CODE is the source of truth. The EXISTING PAGE may be out of date.
- Verify every concrete claim in the existing page against the current source:
  * Lists of items (commands, providers, dependencies, endpoints) — recount from source.
  * Counts ("three commands", "two services") — verify the number is still correct.
  * Named entities (specific symbol names, file paths, env vars) — confirm they exist in source.
  * Signatures (parameter names, types, return types) — match exact source signatures.
- If existing page says "X" but source says "X, Y, Z" — rewrite to include Y and Z.
- If existing page says "three" but source has five — change the number AND the list.
- Do NOT preserve outdated facts just because they were already written.
- DO NOT REMOVE existing factual details (env var lists, fallback behavior, file path conventions, ts-ignore reasons, edge-case notes) just because they were not what triggered this update. Preserve them unless the source contradicts them.
- For sections still accurate, keep wording close to existing to minimize churn.
- If a documented symbol no longer exists in the source, remove its mention.
- Do NOT write a "## Related" section — it is auto-generated from the code graph.

${FORMAT_HINT}
`;
}

export function patchPagePromptNarrative({ slug, existingPage, commitNarrative, pageFocus, currentSignatures, referencesBlock = '' }) {
  return `You are updating a wiki page in response to a code commit. A narrator has already summarized what the commit did — use that summary as the ground truth and apply the relevant parts to this page.

PAGE SLUG: ${slug}

EXISTING PAGE CONTENT:
---
${existingPage}
---

COMMIT NARRATIVE (authoritative — describes what the commit actually did):
---
${commitNarrative}
---

CHANGES RELEVANT TO THIS PAGE (from invalidator):
${pageFocus || '(none — page may be affected via cascade only)'}

CURRENT SIGNATURES OF SYMBOLS ON THIS PAGE:
${currentSignatures}${referencesBlock ? `\n\n${referencesBlock}` : ''}

INSTRUCTIONS:
- The COMMIT NARRATIVE is the source of truth. Update the page to reflect the parts of the narrative that apply to this page's symbols.
- Do not invent details not present in the narrative or signatures.
- For sections still accurate, keep wording close to existing to minimize churn.
- Verify symbol names and signatures against the data above; rewrite parts of the existing page that disagree with the current signatures.
- If the commit narrative does not affect this page directly (cascade only), make minimal cosmetic updates and refresh wording that references changed symbols.
- Do NOT write a "## Related" section — it is auto-generated.

${FORMAT_HINT}
`;
}

export function validatorPrompt({ narrative, pages }) {
  const pageBlocks = pages.map(({ slug, body }) =>
    `--- PAGE: ${slug} ---\n${body}`).join('\n\n');

  return `You are validating that wiki patches correctly reflect a code commit. You receive (1) a commit narrative describing what changed, and (2) the wiki pages updated for that commit. Verify each concrete claim in the narrative landed in at least one updated page.

COMMIT NARRATIVE:
---
${narrative}
---

UPDATED PAGES:
${pageBlocks}

INSTRUCTIONS:
- Read each concrete claim in the narrative (specific symbol added, behavior changed, dependency introduced, env var renamed, etc.).
- For each claim: state whether it is reflected in one of the updated pages (and which one), OR list it as missing.
- Skip vague/general claims that have no testable presence.
- A claim about a symbol on page X must appear on page X.

Output ONLY a single JSON object. No prose before or after, no markdown fences:
{
  "landed":  [ "claim → evidence in slug" ],
  "missing": [ "claim with no evidence" ],
  "score":   0..1   (fraction of testable claims that landed)
}
Do not use any tools.
`;
}

export const JUDGE_SCHEMA = {
  type: 'object',
  required: ['equivalent', 'score', 'differences'],
  properties: {
    equivalent: { type: 'boolean' },
    score: { type: 'number', minimum: 0, maximum: 1 },
    differences: { type: 'array', items: { type: 'string' } },
  },
};

export function judgePrompt({ pageA, pageB, context = '' }) {
  return `You are evaluating whether PAGE A (the candidate) is informationally equivalent to or better than PAGE B (the reference) for documenting the same concept.

${context ? `CONTEXT:\n${context}\n\n` : ''}PAGE A (candidate):
---
${pageA}
---

PAGE B (reference):
---
${pageB}
---

Evaluate:
- Coverage: every concrete fact in PAGE B should appear in PAGE A. A missing fact in A counts as information loss.
- Superset OK: extra concrete facts in PAGE A that are NOT in PAGE B are FINE and do NOT lower the score, as long as they are plausibly grounded.
- Contradictions: if PAGE A states X and PAGE B states not-X (and both refer to the same item), that IS a real disagreement and lowers the score.
- Wording differences are irrelevant.

Score 0..1:
- 1.00  PAGE A covers everything PAGE B covers (extra detail in A is fine).
- 0.85  A covers PAGE B's key facts with at most 1 minor omission, no contradictions.
- 0.70  A loses several non-trivial details OR has 1 minor contradiction.
- 0.40  A loses many key facts OR has a significant contradiction.
- 0.10  A and B describe different things or major factual conflict.

equivalent = true only if score >= 0.80 AND no contradictions.

The "differences" array MUST mark each entry with a prefix:
  "(LOSS-IN-A) <detail>"  — fact present in B but missing in A
  "(EXTRA-IN-A) <detail>" — fact present in A but missing in B (informational only — does not lower score)
  "(CONTRADICT) <detail>" — A and B disagree on a fact

Output ONLY a single JSON object on its own. No prose before or after, no markdown fences. Shape:
{
  "equivalent": boolean,
  "score": number 0..1,
  "differences": [array of short prefixed strings]
}
Do not use any tools.
`;
}
