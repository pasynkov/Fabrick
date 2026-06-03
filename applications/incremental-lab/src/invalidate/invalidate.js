import { AGGRESSIVE_POLICY, buildConsumerIndex, cascadeFrom } from '../cascade/cascade.js';

const TOP_LEVEL_KINDS = new Set(['class', 'interface', 'type', 'function', 'enum', 'const']);

export function invalidate({ diff, sourcemap, currentSymbols }, policy = AGGRESSIVE_POLICY) {
  const symbolToPages = reverseIndex(sourcemap);
  const consumerIdx = buildConsumerIndex(currentSymbols);

  const invalidated = new Set();
  const deleted = new Set();
  const reasons = {}; // slug → reasons[]

  const noteReason = (slug, reason) => {
    if (!reasons[slug]) reasons[slug] = [];
    if (!reasons[slug].includes(reason)) reasons[slug].push(reason);
  };

  const addPagesFor = (symbolId, reason) => {
    const pages = symbolToPages.get(symbolId) ?? [];
    for (const slug of pages) {
      invalidated.add(slug);
      noteReason(slug, reason);
    }
  };

  for (const { after } of diff.symbols.bodyChanged) {
    addPagesFor(after.id, `body:${after.name}`);
  }

  for (const { after } of diff.symbols.sigChanged) {
    addPagesFor(after.id, `sig:${after.name}`);
    const cascaded = cascadeFrom(after.name, consumerIdx, policy.sigCascadeDepth);
    for (const c of cascaded) addPagesFor(c.id, `cascade-sig:${after.name}→${c.name}`);
  }

  for (const before of diff.symbols.deleted) {
    addPagesFor(before.id, `delete:${before.name}`);
    const cascaded = cascadeFrom(before.name, consumerIdx, policy.deleteCascadeDepth);
    for (const c of cascaded) addPagesFor(c.id, `cascade-delete:${before.name}→${c.name}`);
  }

  for (const file of diff.files.deleted) {
    for (const [slug, page] of Object.entries(sourcemap.pages ?? {})) {
      if ((page.files ?? []).includes(file)) {
        invalidated.add(slug);
        noteReason(slug, `file-deleted:${file}`);
      }
    }
  }

  const exportedTopAdded = diff.symbols.added.filter(
    (s) => s.exported && TOP_LEVEL_KINDS.has(s.kind),
  );
  if (policy.addNewSymbolInvalidatesIndex && exportedTopAdded.length > 0) {
    invalidated.add('index.md');
    noteReason('index.md', `new-symbols:${exportedTopAdded.length}`);
  }

  const deletedIds = new Set(diff.symbols.deleted.map((s) => s.id));
  for (const [slug, page] of Object.entries(sourcemap.pages ?? {})) {
    const syms = page.symbols ?? [];
    if (syms.length === 0) continue;
    const allGone = syms.every((id) => deletedIds.has(id));
    if (allGone) { deleted.add(slug); invalidated.delete(slug); }
  }

  const newSymbols = exportedTopAdded;

  return {
    pagesInvalidated: [...invalidated].sort(),
    pagesDeleted: [...deleted].sort(),
    newSymbols: newSymbols.sort((a, b) => (a.id < b.id ? -1 : 1)),
    reasons,
  };
}

function reverseIndex(sourcemap) {
  const idx = new Map();
  for (const [slug, page] of Object.entries(sourcemap.pages ?? {})) {
    for (const id of page.symbols ?? []) {
      if (!idx.has(id)) idx.set(id, []);
      idx.get(id).push(slug);
    }
  }
  return idx;
}
