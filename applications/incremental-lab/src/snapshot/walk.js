import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DEFAULT_IGNORE = new Set([
  'node_modules', '.git', '.fabrick', 'dist', 'build', 'coverage',
  '.next', '.nuxt', '.svelte-kit', 'out', '.cache', '.turbo', '.lab',
]);

const DEFAULT_EXTENSIONS = ['.ts', '.tsx'];

export function walkRepo(repoRoot, { extensions = DEFAULT_EXTENSIONS, ignore = DEFAULT_IGNORE } = {}) {
  const results = [];
  visit(repoRoot, repoRoot, results, new Set(ignore), new Set(extensions));
  return results.sort();
}

function visit(dir, root, out, ignore, extensions) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    if (ignore.has(e.name)) continue;
    if (e.name.startsWith('.') && e.name !== '.') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      visit(full, root, out, ignore, extensions);
    } else if (e.isFile()) {
      const ext = e.name.slice(e.name.lastIndexOf('.'));
      if (extensions.has(ext)) {
        out.push(relative(root, full).split(sep).join('/'));
      }
    }
  }
}
