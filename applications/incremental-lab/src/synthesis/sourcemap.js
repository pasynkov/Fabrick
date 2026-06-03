/**
 * Default architecture taxonomy: 3 cross-cutting pages.
 * Each page subscribes to slug-prefix patterns per repo.
 */
export const DEFAULT_ARCH_TAXONOMY = {
  'arch/overview.md': {
    description: 'Cross-repo overview: services, infra, how they fit together.',
    subscriptions: { code: ['entities/', 'logic/', 'index.md'], infra: ['entities/', 'index.md'] },
  },
  'arch/data-flow.md': {
    description: 'How data moves between services and storage.',
    subscriptions: { code: ['entities/', 'logic/'], infra: ['entities/'] },
  },
  'arch/deployment.md': {
    description: 'Deployment topology: which services ship as which workloads.',
    subscriptions: { code: ['entities/'], infra: ['entities/'] },
  },
};

/**
 * Build a sourcemap from a set of per-repo wiki page slugs and a taxonomy.
 * For each arch page, lists the (repo, slug) refs whose slug starts with one
 * of the page's subscription prefixes for that repo role.
 */
export function buildArchSourcemap({ perRepoSlugs, repoRoles, taxonomy = DEFAULT_ARCH_TAXONOMY }) {
  const out = { pages: {} };
  for (const [archSlug, def] of Object.entries(taxonomy)) {
    const wikiRefs = [];
    for (const [repoName, role] of Object.entries(repoRoles)) {
      const prefixes = def.subscriptions[role] ?? [];
      const slugs = perRepoSlugs[repoName] ?? [];
      for (const slug of slugs) {
        if (prefixes.some((p) => slug.startsWith(p))) {
          wikiRefs.push({ repo: repoName, slug });
        }
      }
    }
    out.pages[archSlug] = { description: def.description, wikiRefs };
  }
  return out;
}
