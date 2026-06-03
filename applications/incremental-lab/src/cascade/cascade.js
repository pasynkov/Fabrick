export const AGGRESSIVE_POLICY = Object.freeze({
  sigCascadeDepth: 2,
  deleteCascadeDepth: Infinity,
  bodyCascadeDepth: 0,
  addNewSymbolInvalidatesIndex: true,
});

export function buildConsumerIndex(symbols) {
  const idx = new Map();
  for (const s of symbols) {
    for (const ref of s.references) {
      if (!idx.has(ref)) idx.set(ref, []);
      idx.get(ref).push(s);
    }
  }
  return idx;
}

export function cascadeFrom(rootName, consumerIdx, depth) {
  const visited = new Set([rootName]);
  const out = [];
  walk(rootName, depth);
  return out;

  function walk(name, d) {
    if (d <= 0) return;
    const consumers = consumerIdx.get(name) ?? [];
    for (const c of consumers) {
      if (visited.has(c.name)) continue;
      visited.add(c.name);
      out.push(c);
      walk(c.name, d - 1);
    }
  }
}
