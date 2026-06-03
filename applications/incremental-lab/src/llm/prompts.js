const FORMAT_HINT = `Return ONLY the markdown content. No \`\`\`markdown fences, no preamble, no explanation. Do not use any tools — all the source code you need is in this prompt.`;

export function generatePagePrompt({ slug, symbols, sources }) {
  const symbolList = symbols.map((s) => `  - ${s.id} (${s.kind})`).join('\n');
  const sourceBlocks = sources.map((s) => `[file: ${s.file}]\n${s.content}`).join('\n\n');

  return `You are a technical writer producing a concise wiki page for a code symbol.

PAGE SLUG: ${slug}

SYMBOLS DOCUMENTED ON THIS PAGE:
${symbolList}

SOURCE CODE:
${sourceBlocks}

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
- For sections still accurate, keep wording close to existing to minimize churn.
- If a documented symbol no longer exists in the source, remove its mention.
- Do NOT write a "## Related" section — it is auto-generated from the code graph.

${FORMAT_HINT}
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
  return `You are evaluating semantic equivalence of two wiki pages that describe the same code symbol. The PURPOSE is not exact text match — it is whether a reader would gain the same understanding from both.

${context ? `CONTEXT:\n${context}\n\n` : ''}PAGE A:
---
${pageA}
---

PAGE B:
---
${pageB}
---

Evaluate:
- Do they describe the same symbol(s) with the same key facts?
- Same level of detail? Same accuracy?
- Any factual disagreement (one claims X, other claims not-X)?

Score:
- 1.0 = semantically equivalent (small wording differences are fine)
- 0.7-0.9 = mostly equivalent, minor information loss in one
- 0.3-0.6 = significant difference (different focus, missing key facts)
- 0.0-0.2 = describing different things or major factual conflict

equivalent = true only if score >= 0.8.

Output ONLY a single JSON object on its own. No prose before or after, no markdown fences. Shape:
{
  "equivalent": boolean,
  "score": number 0..1,
  "differences": [array of short strings]
}
Do not use any tools.
`;
}
