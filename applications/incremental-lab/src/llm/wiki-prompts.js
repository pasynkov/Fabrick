const FORMAT_HINT = `Return ONLY the JSON. No markdown fences, no preamble. Do not use any tools.`;

const SCOPE_HINT_BY_KIND = {
  app: `This scope is ONE deployable microservice. Focus on:
- service identity (name, framework, deployment kind)
- incoming surface (NATS subjects, HTTP routes, message queues)
- outgoing dependencies (other services, databases, queues, object storage)
- business behavior (returns what from where, what data is transformed)
- environment variables it reads
NOT on: method bodies, helper internals, private state.`,
  lib: `This scope is a SHARED LIBRARY. Focus on:
- what it exports (public interface) and what problem it solves
- key types / decorators / factories consumed by services
- behavior contracts (lifecycle, error modes)
NOT on: internal implementation, private classes.`,
  root: `This scope is the WHOLE repository (single-project layout). Treat it as
one service with the same focus as an app scope.`,
};

export function scopeHint(kind) {
  return SCOPE_HINT_BY_KIND[kind] ?? SCOPE_HINT_BY_KIND.app;
}

/**
 * Essence extractor — operates on a single scope (one app or one lib).
 * Output: structured features that describe SERVICE-LEVEL changes
 * (new endpoints, env vars, deployment-affecting shifts), not method internals.
 */
export function essenceExtractorPrompt({ diff, sourcemap, repoName, scopeName, scopeKind, changedFileContents = {}, unifiedDiff = '' }) {
  const lines = [];
  lines.push(`You are analyzing a code commit on scope "${scopeName}" (kind: ${scopeKind}) in repo "${repoName}".`);
  lines.push('');
  lines.push('SCOPE FOCUS:');
  lines.push(scopeHint(scopeKind));
  lines.push('');
  lines.push('Produce a structured list of FEATURES (architectural/interface change units).');
  lines.push('Each feature should be:');
  lines.push('- Conceptually atomic (one logical thing).');
  lines.push('- Named with a short subject + concrete details.');
  lines.push('- Classified by kind: added-endpoint, modified-endpoint, removed-endpoint,');
  lines.push('  added-dependency, config-change, deployment-change, behavior-change, refactor.');
  lines.push('- Tagged with the wiki page slugs it affects (affectedPages).');
  lines.push('- SKIP pure method-body refactors that do not change the service interface.');
  lines.push('');
  lines.push('SYMBOL DIFF:');
  for (const s of diff.symbols.added) lines.push(`  added ${s.kind}: ${s.name}  (file: ${s.file})  ${s.signature}`);
  for (const { before, after } of diff.symbols.sigChanged) lines.push(`  sigchg: ${after.name}  before: ${before.signature}  after: ${after.signature}`);
  for (const { after } of diff.symbols.bodyChanged) {
    if (after.kind === 'method') continue; // implementation noise
    lines.push(`  body: ${after.name}  (${after.kind}, file: ${after.file})`);
  }
  for (const s of diff.symbols.deleted) lines.push(`  deleted ${s.kind}: ${s.name}  (was in ${s.file})`);
  if (diff.importsChanged?.length) {
    lines.push('', 'IMPORT CHANGES:');
    for (const ic of diff.importsChanged.slice(0, 10)) {
      if (ic.addedImports?.length) lines.push(`  ${ic.file}: +${ic.addedImports.join(', ')}`);
      if (ic.removedImports?.length) lines.push(`  ${ic.file}: -${ic.removedImports.join(', ')}`);
    }
  }
  if (diff.files?.added?.length || diff.files?.deleted?.length) {
    lines.push('', 'FILE CHANGES:');
    for (const f of diff.files.added) lines.push(`  +${f}`);
    for (const f of diff.files.deleted) lines.push(`  -${f}`);
  }
  if (unifiedDiff) {
    lines.push('', 'UNIFIED DIFF (authoritative — every change is here, including YAML manifest field updates the symbol diff cannot express):');
    lines.push('```diff');
    lines.push(unifiedDiff);
    lines.push('```');
  }
  const changedFileEntries = Object.entries(changedFileContents);
  if (changedFileEntries.length) {
    lines.push('', 'CURRENT CONTENT OF CHANGED FILES (for context — derive features from the diff above):');
    for (const [file, content] of changedFileEntries) {
      lines.push('', `[file: ${file}]`);
      lines.push(content);
    }
  }
  lines.push('', 'WIKI PAGES IN THIS SCOPE:');
  for (const [slug, page] of Object.entries(sourcemap.pages ?? {})) {
    if (slug === 'index.md') continue;
    if (!page.symbols?.length) continue;
    const names = page.symbols.map((id) => id.split('::')[1]).filter(Boolean).slice(0, 6);
    lines.push(`  ${slug}  [${names.join(', ')}${page.symbols.length > 6 ? ', …' : ''}]`);
  }
  lines.push('');
  lines.push('INSTRUCTIONS:');
  lines.push('- Group related symbol changes into ONE feature when they describe the same change.');
  lines.push('- Each feature MUST have at least one affectedPages slug (must be a slug listed above).');
  lines.push('- Small mechanical-looking diffs CAN be architecturally important — call them out (e.g. "concurrency 4 → 8").');
  lines.push('- Skip pure renames, formatting, and method-body-only refactors.');
  lines.push('- If the commit only touches method bodies with no interface effect, return an empty features array.');
  lines.push('- When a UNIFIED DIFF is given: enumerate EVERY semantically meaningful change. Treat each field flip (image tag, probe timing, env var value, replica count, strategy type) as its own feature unless directly part of a larger atomic change. Do NOT summarize away config edits.');
  lines.push('');
  lines.push('Output ONLY JSON with this shape:');
  lines.push('{');
  lines.push('  "features": [');
  lines.push('    {');
  lines.push('      "id": "f1",');
  lines.push('      "kind": "added-endpoint",');
  lines.push('      "subject": "bulk instrument fetch with streaming",');
  lines.push('      "details": "new findInstruments NATS handler returns Observable when payload.stream and skip=0",');
  lines.push('      "affectedPages": ["contracts/nats.md", "service.md"]');
  lines.push('    }');
  lines.push('  ]');
  lines.push('}');
  lines.push('');
  lines.push(FORMAT_HINT);
  return lines.join('\n');
}
