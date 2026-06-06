/**
 * Synthesis layer prompts. Topics are fixed (4 pages). System prompt is the
 * skill markdown (loaded by caller). User content is the bundle of per-repo
 * wikis with their scope metadata.
 */

export const SYNTHESIS_PAGE_SLUGS = ['system.md', 'data-flows.md', 'transport-graph.md', 'infra.md'];

export function synthesisGeneratePrompt({ system: systemName, repos, skill }) {
  const repoBlocks = repos.map((r) => renderRepoBlock(r)).join('\n\n');
  const user = `SYSTEM: ${systemName}

REPOS (${repos.length}):
${repoBlocks}
`;
  return { system: skill, user };
}

function renderRepoBlock(repo) {
  const lines = [];
  lines.push(`=== repo: ${repo.repoName} ===`);
  if (repo.project) {
    lines.push(`project: ${repo.project.kind ?? '?'} | ${repo.project.language ?? '?'} | ${repo.project.framework ?? '?'}`);
    if (repo.project.summary) lines.push(`summary: ${repo.project.summary}`);
  }
  for (const scope of repo.scopes) {
    lines.push('');
    lines.push(`### scope: ${scope.name}  (path: ${scope.root})`);
    for (const [slug, body] of Object.entries(scope.pages)) {
      lines.push('');
      lines.push(`--- ${slug} ---`);
      lines.push(body ?? '(empty)');
    }
  }
  return lines.join('\n');
}

export function computeSynthesisPatchPrompt({ system: systemName, existingPages, changedWikiPages }) {
  const existingBlock = SYNTHESIS_PAGE_SLUGS.map((slug) =>
    `--- ${slug} ---\n${existingPages[slug] ?? '(empty)'}`
  ).join('\n\n');

  const changesBlock = changedWikiPages.map((c) => {
    const counts = c.symbolCounts ?? {};
    const countsStr = `+${counts.added ?? 0} -${counts.deleted ?? 0} ~${counts.changed ?? 0}`;
    const header = `### ${c.repoName} / ${c.scopeName} / ${c.slug}  (${c.changeKind}; symbols ${countsStr})`;
    if (c.changeKind === 'deleted') return `${header}\n(scope/page removed)`;
    return `${header}\n--- previous body ---\n${c.before ?? '(none)'}\n\n--- current body ---\n${c.after ?? '(empty)'}`;
  }).join('\n\n');

  const system = `You compute a detailed patch for the 4-page cross-repo synthesis of system "${systemName}".

Input: the current synthesis pages + every wiki page that changed since synthesis was last generated. Each change shows the previous AND current bodies in full plus a symbol-counts header (added/deleted/changed bullets+table rows). Decide which synthesis topics need updates and produce a patch document.

TOPICS TO MAINTAIN:
- system.md            high-level architecture, services, repos, runtime platform
- data-flows.md        end-to-end business pipelines
- transport-graph.md   inter-service messaging (NATS subjects / Kafka topics / HTTP routes / gRPC)
- infra.md             deployment topology, ConfigMaps, integrations

PATCH RULES:
- For each topic, decide whether the wiki changes affect it. If not, emit exactly: "no changes"
- Otherwise emit a numbered list of concrete instructions. Each instruction:
  * names the target section / bullet so it can be located in the existing topic
  * states the exact new content (verbatim names, identifiers, numbers from the changed wikis)
  * is minimal — touch only what changed
- Preserve all existing factual detail unaffected by the changes.
- Synthesis evidence: every new claim cites the wiki page via [scope → slug](repos/<repoName>/scopes/<dir>/<slug>). Preserve all existing wiki links.

INSTRUCTION VOCABULARY:
- REPLACE <target> WITH: <new text>
- ADD UNDER <section heading or list>: <new content>
- REMOVE <target>

OUTPUT FORMAT (emit exactly these 4 sections in this order):

=== PATCH: system.md ===
<instructions OR "no changes">

=== PATCH: data-flows.md ===
<instructions OR "no changes">

=== PATCH: transport-graph.md ===
<instructions OR "no changes">

=== PATCH: infra.md ===
<instructions OR "no changes">

Return ONLY the patch sections. No code fences, no preamble. Do not use any tools.`;

  const user = `SYSTEM: ${systemName}

EXISTING SYNTHESIS PAGES:
${existingBlock}

CHANGED WIKI PAGES (${changedWikiPages.length}):
${changesBlock}
`;

  return { system, user };
}

export function applySynthesisPatchPrompt({ system: systemName, existingPages, patchBySlug, slugsToApply }) {
  const existingBlock = slugsToApply.map((slug) =>
    `--- existing ${slug} ---\n${existingPages[slug] ?? '(empty)'}`
  ).join('\n\n');
  const patchBlock = slugsToApply.map((slug) =>
    `=== PATCH: ${slug} ===\n${patchBySlug[slug] ?? ''}`
  ).join('\n\n');
  const PAGE_BLOCK_SCHEMA = slugsToApply.map((slug) =>
    `=== PAGE: ${slug} ===\n<full page body after applying patch>`
  ).join('\n\n');

  const system = `You apply a pre-computed synthesis patch to ${slugsToApply.length} topic page(s) of system "${systemName}".

RULES:
- For each page, apply the instructions in its patch section verbatim.
- Do NOT introduce facts not present in the existing page or the patch instructions.
- Do NOT remove existing content unless the patch explicitly says REMOVE.
- PRESERVE every markdown wiki-page link (the [scope → slug](repos/...) form). Keep existing ones, add new ones the patch supplies.
- Keep formatting (markdown headings, tables, bullet style) consistent with the existing page.

OUTPUT FORMAT (emit exactly these ${slugsToApply.length} page section(s) in order, full body each):

${PAGE_BLOCK_SCHEMA}

Return ONLY the page sections. No code fences, no preamble. Do not use any tools.`;

  const user = `SYSTEM: ${systemName}

EXISTING SYNTHESIS PAGES (only those with patches):
${existingBlock}

PATCHES TO APPLY:
${patchBlock}
`;

  return { system, user };
}

export function parseSynthesisOutput(raw) {
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
