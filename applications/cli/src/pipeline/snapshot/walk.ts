import { readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const DEFAULT_IGNORE = new Set([
  'node_modules', '.git', '.fabrick', 'dist', 'build', 'coverage',
  '.next', '.nuxt', '.svelte-kit', 'out', '.cache', '.turbo', '.lab',
]);

const DEFAULT_EXTENSIONS = new Set(['.ts', '.tsx', '.yaml', '.yml']);

export function walkRepo(repoRoot: string, opts: { extensions?: Set<string>; ignore?: Set<string> } = {}): string[] {
  const results: string[] = [];
  const extensions = opts.extensions ?? DEFAULT_EXTENSIONS;
  const ignore = opts.ignore ?? DEFAULT_IGNORE;
  visit(repoRoot, repoRoot, results, ignore, extensions);
  return results.sort();
}

function visit(dir: string, root: string, out: string[], ignore: Set<string>, extensions: Set<string>): void {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
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
