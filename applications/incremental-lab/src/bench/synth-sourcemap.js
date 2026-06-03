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
  const symById = new Map(newSnapshot.symbols.map((s) => [s.id, s]));

  for (const slug of invalidation.pagesDeleted) delete next.pages[slug];

  for (const slug of invalidation.pagesInvalidated) {
    if (!next.pages[slug]) { next.pages[slug] = { symbols: [], files: [] }; continue; }
    const existing = next.pages[slug];
    const liveSymbols = existing.symbols.filter((id) => symById.has(id));
    next.pages[slug] = {
      symbols: liveSymbols.slice().sort(),
      files: deriveFiles(liveSymbols, symById),
    };
  }

  for (const sym of invalidation.newSymbols) {
    const slug = pageSlugFor(sym);
    const page = next.pages[slug] ?? { symbols: [], files: [] };
    if (!page.symbols.includes(sym.id)) page.symbols.push(sym.id);
    page.symbols.sort();
    page.files = deriveFiles(page.symbols, symById);
    next.pages[slug] = page;
  }

  return next;
}

function deriveFiles(symbolIds, symById) {
  const files = new Set();
  for (const id of symbolIds) {
    const s = symById.get(id);
    if (s) files.add(s.file);
  }
  return [...files].sort();
}
