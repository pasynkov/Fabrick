export function computeRelated({ slug, sourcemap, snapshot, maxOut = 8 }) {
  const page = sourcemap.pages?.[slug];
  if (!page || !page.symbols?.length) return [];

  const symbolById = new Map(snapshot.symbols.map((s) => [s.id, s]));
  const symbolsByName = new Map();
  for (const s of snapshot.symbols) {
    if (!symbolsByName.has(s.name)) symbolsByName.set(s.name, []);
    symbolsByName.get(s.name).push(s);
  }
  const pageBySymbol = new Map();
  for (const [otherSlug, otherPage] of Object.entries(sourcemap.pages ?? {})) {
    for (const id of otherPage.symbols ?? []) pageBySymbol.set(id, otherSlug);
  }

  const ownSymbols = page.symbols.map((id) => symbolById.get(id)).filter(Boolean);
  const ownNames = new Set(ownSymbols.map((s) => s.name));

  const outgoing = new Map();

  for (const own of ownSymbols) {
    for (const ref of own.references ?? []) {
      if (ownNames.has(ref)) continue;
      const candidates = symbolsByName.get(ref) ?? [];
      for (const cand of candidates) {
        const targetSlug = pageBySymbol.get(cand.id);
        if (!targetSlug || targetSlug === slug) continue;
        outgoing.set(targetSlug, (outgoing.get(targetSlug) ?? 0) + 1);
      }
    }
  }

  const sorted = [...outgoing.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, maxOut)
    .map(([s]) => s);

  return sorted;
}

export function pageTitleFor(slug, sourcemap, snapshot) {
  const page = sourcemap.pages?.[slug];
  const id = page?.symbols?.[0];
  if (id) {
    const sym = snapshot.symbols.find((s) => s.id === id);
    if (sym) return sym.name;
  }
  const file = slug.replace(/\.md$/, '').split('/').pop();
  return file;
}
