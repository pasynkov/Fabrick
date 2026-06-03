export function validate({ snapshot, sourcemap }) {
  const violations = [];
  const symbolIds = new Set(snapshot.symbols.map((s) => s.id));
  const fileSet = new Set(Object.keys(snapshot.files));

  for (const [slug, page] of Object.entries(sourcemap.pages ?? {})) {
    const syms = page.symbols ?? [];
    const files = page.files ?? [];

    for (const id of syms) {
      if (!symbolIds.has(id)) {
        violations.push({ invariant: 'I1', page: slug, symbol: id,
          message: `page cites symbol "${id}" not present in snapshot` });
      }
    }

    for (const f of files) {
      if (!fileSet.has(f)) {
        violations.push({ invariant: 'I2', page: slug, file: f,
          message: `page cites file "${f}" not present in snapshot` });
      }
    }

    if (syms.length > 0 && syms.every((id) => !symbolIds.has(id))) {
      violations.push({ invariant: 'I5', page: slug,
        message: `page is orphan: none of its symbols exist in snapshot` });
    }
  }

  return { ok: violations.length === 0, violations };
}

export function structuralEquivalence(sourcemapA, sourcemapB) {
  const pagesA = new Set(Object.keys(sourcemapA.pages ?? {}));
  const pagesB = new Set(Object.keys(sourcemapB.pages ?? {}));
  const onlyInA = [...pagesA].filter((p) => !pagesB.has(p)).sort();
  const onlyInB = [...pagesB].filter((p) => !pagesA.has(p)).sort();
  const symbolsDiffer = [];
  const filesDiffer = [];
  for (const slug of pagesA) {
    if (!pagesB.has(slug)) continue;
    const a = sourcemapA.pages[slug];
    const b = sourcemapB.pages[slug];
    if (!sameSet(a.symbols, b.symbols)) symbolsDiffer.push(slug);
    if (!sameSet(a.files, b.files)) filesDiffer.push(slug);
  }
  const totalPages = new Set([...pagesA, ...pagesB]).size || 1;
  const drift = (onlyInA.length + onlyInB.length + symbolsDiffer.length + filesDiffer.length) / totalPages;
  return { onlyInA, onlyInB, symbolsDiffer: symbolsDiffer.sort(), filesDiffer: filesDiffer.sort(), drift };
}

function sameSet(a = [], b = []) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}
