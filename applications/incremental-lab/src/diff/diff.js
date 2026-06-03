export function diffSnapshots(before, after) {
  return {
    files: diffFiles(before.files, after.files),
    symbols: diffSymbols(before.symbols, after.symbols),
    importsChanged: diffImports(before.symbols, after.symbols),
  };
}

function diffFiles(a, b) {
  const aKeys = new Set(Object.keys(a));
  const bKeys = new Set(Object.keys(b));
  const added = [...bKeys].filter((k) => !aKeys.has(k)).sort();
  const deleted = [...aKeys].filter((k) => !bKeys.has(k)).sort();
  const changed = [...bKeys]
    .filter((k) => aKeys.has(k) && a[k].hash !== b[k].hash)
    .sort();
  return { added, deleted, changed };
}

function diffSymbols(aSyms, bSyms) {
  const aMap = new Map(aSyms.map((s) => [s.id, s]));
  const bMap = new Map(bSyms.map((s) => [s.id, s]));
  const added = [];
  const deleted = [];
  const sigChanged = [];
  const bodyChanged = [];

  for (const [id, b] of bMap) {
    const a = aMap.get(id);
    if (!a) { added.push(b); continue; }
    if (a.signature !== b.signature) { sigChanged.push({ before: a, after: b }); continue; }
    if (a.bodyHash !== b.bodyHash) { bodyChanged.push({ before: a, after: b }); }
  }
  for (const [id, a] of aMap) if (!bMap.has(id)) deleted.push(a);

  const byId = (x, y) => (idOf(x) < idOf(y) ? -1 : idOf(x) > idOf(y) ? 1 : 0);
  added.sort(byId); deleted.sort(byId); sigChanged.sort(byId); bodyChanged.sort(byId);
  return { added, deleted, sigChanged, bodyChanged };
}

function idOf(x) { return x.id ?? x.after?.id ?? x.before?.id; }

function diffImports(aSyms, bSyms) {
  const aByFile = importsByFile(aSyms);
  const bByFile = importsByFile(bSyms);
  const changes = [];
  const allFiles = new Set([...aByFile.keys(), ...bByFile.keys()]);
  for (const file of [...allFiles].sort()) {
    const aImps = aByFile.get(file) ?? new Set();
    const bImps = bByFile.get(file) ?? new Set();
    const addedImports = [...bImps].filter((x) => !aImps.has(x)).sort();
    const removedImports = [...aImps].filter((x) => !bImps.has(x)).sort();
    if (addedImports.length || removedImports.length) {
      changes.push({ file, addedImports, removedImports });
    }
  }
  return changes;
}

function importsByFile(symbols) {
  const out = new Map();
  for (const s of symbols) {
    if (!out.has(s.file)) out.set(s.file, new Set(s.imports));
  }
  return out;
}
