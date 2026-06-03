/**
 * Diff two synthesis snapshots. Returns per-repo change set
 * { added, changed, deleted } for wiki pages.
 */
export function diffSynthesisSnapshots(before, after) {
  const repos = new Set([...Object.keys(before.repos ?? {}), ...Object.keys(after.repos ?? {})]);
  const out = {};
  for (const repo of repos) {
    const beforePages = before.repos[repo]?.pages ?? {};
    const afterPages = after.repos[repo]?.pages ?? {};
    const beforeSlugs = new Set(Object.keys(beforePages));
    const afterSlugs = new Set(Object.keys(afterPages));
    const added = [...afterSlugs].filter((s) => !beforeSlugs.has(s)).sort();
    const deleted = [...beforeSlugs].filter((s) => !afterSlugs.has(s)).sort();
    const changed = [...afterSlugs]
      .filter((s) => beforeSlugs.has(s) && beforePages[s].hash !== afterPages[s].hash)
      .sort();
    out[repo] = { added, changed, deleted };
  }
  return out;
}

export function diffHasChanges(diff) {
  for (const r of Object.values(diff)) {
    if (r.added.length || r.changed.length || r.deleted.length) return true;
  }
  return false;
}
