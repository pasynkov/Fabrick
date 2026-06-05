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
