const FORMAT_HINT = `Return ONLY the markdown content. No fences, no preamble, no explanation. Do not use any tools.`;

export function generateArchPagePrompt({ archSlug, wikiExcerpts }) {
  const blocks = wikiExcerpts.map(({ repo, slug, body }) =>
    `--- WIKI: ${repo}/${slug} ---\n${body}`,
  ).join('\n\n');

  return `You are a software architect writing one architecture document by synthesizing per-component wiki pages from multiple repos.

ARCH PAGE SLUG: ${archSlug}

WIKI PAGES (input from repos):
${blocks}

INSTRUCTIONS:
- Write the architecture page about "${archSlug}".
- Synthesize cross-repo: tie services in the code repo to their deployments in the infra repo, name explicit links.
- Cite each repo as plain text when relevant (e.g. "backend1/AssetsService → kustomize/Deployment assets-registry").
- Concise, factual, no marketing.
- Sections: # Title, 1–2 paragraph overview, ## Components (bullet list per repo), ## Cross-repo links, ## Notes (if any).
- Do NOT write a "## Related" section — it is auto-generated.

${FORMAT_HINT}
`;
}

export function patchArchPagePrompt({ archSlug, existingPage, narrative, wikiExcerpts, changeReasons }) {
  const blocks = wikiExcerpts.map(({ repo, slug, body }) =>
    `--- WIKI: ${repo}/${slug} ---\n${body}`,
  ).join('\n\n');

  return `You are updating an architecture page in response to per-repo wiki updates.

ARCH PAGE SLUG: ${archSlug}

EXISTING ARCH PAGE:
---
${existingPage}
---

CHANGES THAT HAPPENED ACROSS REPOS (narrator summary, authoritative):
---
${narrative}
---

WHICH WIKI PAGES TRIGGERED THIS UPDATE:
${changeReasons.map((r) => `  - ${r}`).join('\n')}

CURRENT WIKI PAGES (source of truth for facts):
${blocks}

INSTRUCTIONS:
- Source of truth: the current wiki pages above. Verify every claim in the existing arch page.
- Update narrative-anchored sections (counts, lists, named services) against the wikis.
- Preserve sections that are still accurate.
- Cross-repo links (code service → k8s deployment) are the highest-value content — keep them current.
- Do NOT write a "## Related" section — it is auto-generated.

${FORMAT_HINT}
`;
}

export function synthesisNarratorPrompt({ diff, recentWikiUpdates }) {
  const lines = ['You are an architect summarizing a cross-repo update. Read the wiki-page diff across all repos and produce a 2-5 sentence narrative of what changed at the architecture level.', ''];
  lines.push('WIKI DIFF (per repo):');
  for (const [repo, changes] of Object.entries(diff)) {
    const all = [...changes.added.map((s) => `+${s}`), ...changes.changed.map((s) => `~${s}`), ...changes.deleted.map((s) => `-${s}`)];
    if (all.length === 0) continue;
    lines.push(`  ${repo}: ${all.join(', ')}`);
  }
  if (recentWikiUpdates?.length) {
    lines.push('', 'EXCERPTS OF UPDATED WIKI PAGES (for context):');
    for (const { repo, slug, body } of recentWikiUpdates.slice(0, 5)) {
      lines.push(`--- ${repo}/${slug} (first 800 chars) ---`);
      lines.push(body.slice(0, 800));
      lines.push('');
    }
  }
  lines.push('', 'INSTRUCTIONS:');
  lines.push('- 2–5 sentences in plain prose.');
  lines.push('- Focus on architectural significance: new services, capacity changes, infra wiring, breaking interface shifts.');
  lines.push('- Skip non-architectural noise (formatting, doc cleanup).');
  lines.push('- No marketing, no bullets, no markdown fences.');
  lines.push('- Return ONLY the summary text.');
  return lines.join('\n');
}
