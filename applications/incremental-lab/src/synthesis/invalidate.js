/**
 * Given an arch sourcemap { archSlug → [{repo, slug}] } and a synthesis diff,
 * return which arch pages need rebuild.
 */
export function invalidateArchPages({ diff, archSourcemap }) {
  const touchedRefs = new Set();
  for (const [repo, changes] of Object.entries(diff)) {
    for (const slug of [...changes.added, ...changes.changed, ...changes.deleted]) {
      touchedRefs.add(`${repo}::${slug}`);
    }
  }
  const invalidated = new Set();
  const reasons = {};
  for (const [archSlug, page] of Object.entries(archSourcemap.pages ?? {})) {
    for (const ref of page.wikiRefs ?? []) {
      const key = `${ref.repo}::${ref.slug}`;
      if (touchedRefs.has(key)) {
        invalidated.add(archSlug);
        (reasons[archSlug] ||= []).push(key);
      }
    }
  }
  return { archInvalidated: [...invalidated].sort(), reasons };
}
