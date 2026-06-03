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
