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

const SYNTHESIS_TOPIC_FOCUS = {
  'system.md':          'High-level architecture: WHAT the system is, repos it spans, deployable services, runtime platform.',
  'data-flows.md':      'End-to-end business pipelines. Chain of services per pipeline + data shape at each hop.',
  'transport-graph.md': 'Inter-service messaging graph: NATS subjects / Kafka topics / HTTP routes / gRPC produced and consumed.',
  'infra.md':           'Deployment topology: namespaces, replicas, scaling, ConfigMaps, external systems.',
};

export function computeSynthesisPatchPerTopicPrompt({ system: systemName, topic, existingPages, changedWikiPages }) {
  const targetBody = existingPages[topic] ?? '(empty)';
  const otherBlock = SYNTHESIS_PAGE_SLUGS.filter((s) => s !== topic).map((s) =>
    `--- ${s} (read-only) ---\n${existingPages[s] ?? '(empty)'}`
  ).join('\n\n');

  const changesBlock = changedWikiPages.map((c) => {
    const counts = c.symbolCounts ?? {};
    const countsStr = `+${counts.added ?? 0} -${counts.deleted ?? 0} ~${counts.changed ?? 0}`;
    const header = `### ${c.repoName} / ${c.scopeName} / ${c.slug}  (${c.changeKind}; symbols ${countsStr})`;
    if (c.changeKind === 'deleted') return `${header}\n(scope/page removed)`;
    return `${header}\n--- previous body ---\n${c.before ?? '(none)'}\n\n--- current body ---\n${c.after ?? '(empty)'}`;
  }).join('\n\n');

  const system = `You compute a patch for ONE synthesis topic of system "${systemName}".

YOUR TARGET TOPIC: ${topic}
FOCUS: ${SYNTHESIS_TOPIC_FOCUS[topic] ?? ''}

You also see the OTHER 3 synthesis topics as read-only context. Do NOT duplicate content that another topic already covers — your patch should only touch ${topic}.

PATCH RULES:
- Read the wiki diffs (full before+after bodies + symbol counts).
- Decide what changes affect ${topic} specifically.
- If unaffected, emit exactly: "no changes"
- Otherwise emit a numbered list of concrete instructions for ${topic}:
  * name target section / bullet so it can be located
  * state exact new content (verbatim identifiers, names, numbers from the wikis)
  * minimal — touch only what changed
- Preserve all existing factual detail unaffected.
- Synthesis evidence: every new claim cites the wiki page via [scope → slug](repos/<repoName>/scopes/<dir>/<slug>). PRESERVE existing wiki links; never emit source-file paths.

INSTRUCTION VOCABULARY:
- REPLACE <target> WITH: <new text>
- ADD UNDER <section heading or list>: <new content>
- REMOVE <target>

OUTPUT FORMAT (emit exactly one section):

=== PATCH: ${topic} ===
<instructions OR "no changes">

Return ONLY the patch section. No code fences, no preamble. Do not use any tools.`;

  const user = `SYSTEM: ${systemName}

EXISTING ${topic} (your target):
${targetBody}

OTHER SYNTHESIS TOPICS (read-only, do not duplicate):
${otherBlock}

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
