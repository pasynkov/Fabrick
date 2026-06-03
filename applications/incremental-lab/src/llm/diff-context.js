export function buildSlimChangeContext({ pageSymbolIds, diff }) {
  const onPage = (id) => pageSymbolIds.has(id);
  const lines = [];

  for (const { before, after } of diff.symbols.sigChanged) {
    if (!onPage(after.id)) continue;
    lines.push(`SIGNATURE CHANGED: ${after.name} (${after.kind})`);
    lines.push(`  before: ${before.signature}`);
    lines.push(`  after:  ${after.signature}`);
  }
  for (const { after } of diff.symbols.bodyChanged) {
    if (!onPage(after.id)) continue;
    lines.push(`BODY CHANGED (signature unchanged): ${after.name} (${after.kind})`);
  }
  for (const s of diff.symbols.added) {
    lines.push(`ADDED: ${s.name} (${s.kind})`);
    lines.push(`  signature: ${s.signature}`);
  }
  for (const s of diff.symbols.deleted) {
    if (!onPage(s.id)) continue;
    lines.push(`REMOVED: ${s.name} (${s.kind})`);
    lines.push(`  was: ${s.signature}`);
  }

  return lines.join('\n');
}

export function currentSymbolSignatures({ symbols }) {
  return symbols
    .map((s) => `${s.id}  ${s.signature}`)
    .join('\n');
}

export function buildReferencesBlock({ pageSymbols, beforeSymbols, afterSymbols }) {
  const beforeById = new Map((beforeSymbols ?? []).map((s) => [s.id, s]));
  const afterById = new Map((afterSymbols ?? []).map((s) => [s.id, s]));

  const currentLines = ['REFERENCED IDENTIFIERS PER SYMBOL ON THIS PAGE:'];
  let anyCurrent = false;
  for (const sym of pageSymbols) {
    const after = afterById.get(sym.id) ?? sym;
    const refs = after.references ?? [];
    if (refs.length === 0) continue;
    anyCurrent = true;
    currentLines.push(`  ${after.name}: [${refs.join(', ')}]`);
  }

  const diffLines = ['REFERENCED IDENTIFIERS — CHANGES SINCE PREVIOUS SNAPSHOT:'];
  let anyDiff = false;
  for (const sym of pageSymbols) {
    const before = beforeById.get(sym.id);
    const after = afterById.get(sym.id) ?? sym;
    if (!before) continue;
    const beforeRefs = new Set(before.references ?? []);
    const afterRefs = new Set(after.references ?? []);
    const added = [...afterRefs].filter((r) => !beforeRefs.has(r)).sort();
    const removed = [...beforeRefs].filter((r) => !afterRefs.has(r)).sort();
    if (!added.length && !removed.length) continue;
    anyDiff = true;
    diffLines.push(`  ${after.name}:`);
    if (added.length) diffLines.push(`    added:   [${added.join(', ')}]`);
    if (removed.length) diffLines.push(`    removed: [${removed.join(', ')}]`);
  }

  const parts = [];
  if (anyCurrent) parts.push(currentLines.join('\n'));
  if (anyDiff) parts.push(diffLines.join('\n'));
  return parts.join('\n\n');
}
