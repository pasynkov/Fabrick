const TOP_LEVEL_KINDS = new Set(['class', 'interface', 'type', 'function', 'enum', 'const']);

export function synthSourcemap(snapshot) {
  const pages = { 'index.md': { symbols: [], files: [] } };
  for (const s of snapshot.symbols) {
    if (!s.exported || !TOP_LEVEL_KINDS.has(s.kind)) continue;
    const slug = pageSlugFor(s);
    if (!pages[slug]) pages[slug] = { symbols: [], files: [] };
    pages[slug].symbols.push(s.id);
    if (!pages[slug].files.includes(s.file)) pages[slug].files.push(s.file);
  }
  for (const slug of Object.keys(pages)) {
    pages[slug].symbols.sort();
    pages[slug].files.sort();
  }
  return { pages };
}

function pageSlugFor(s) {
  const kindDir = {
    class: 'entities', interface: 'entities', type: 'types',
    function: 'logic', enum: 'enums', const: 'consts',
  }[s.kind] ?? 'misc';
  const safeName = s.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${kindDir}/${safeName}.md`;
}

export function applyInvalidation({ sourcemap, invalidation, newSnapshot }) {
  const next = { pages: { ...sourcemap.pages } };
  for (const slug of invalidation.pagesDeleted) delete next.pages[slug];

  for (const slug of invalidation.pagesInvalidated) {
    if (!next.pages[slug]) { next.pages[slug] = { symbols: [], files: [] }; continue; }
    const existing = next.pages[slug];
    const symIds = new Set(newSnapshot.symbols.map((s) => s.id));
    next.pages[slug] = {
      symbols: existing.symbols.filter((id) => symIds.has(id)).sort(),
      files: existing.files.slice().sort(),
    };
  }

  for (const sym of invalidation.newSymbols) {
    const slug = pageSlugFor(sym);
    if (!next.pages[slug]) next.pages[slug] = { symbols: [], files: [] };
    if (!next.pages[slug].symbols.includes(sym.id)) {
      next.pages[slug].symbols.push(sym.id);
      next.pages[slug].symbols.sort();
    }
    if (!next.pages[slug].files.includes(sym.file)) {
      next.pages[slug].files.push(sym.file);
      next.pages[slug].files.sort();
    }
  }

  return next;
}
