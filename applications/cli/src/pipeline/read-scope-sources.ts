import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const SOURCE_EXT = /\.(tsx?|jsx?)$/i;
const SKIP_DIR = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.fabrick']);
const MAX_FILES = 30;
const MAX_BYTES_PER_FILE = 8000;

export async function readScopeSources(scopeRoot: string): Promise<Array<{ file: string; content: string }>> {
  const out: Array<{ file: string; content: string }> = [];

  function walk(dir: string, relPrefix: string): void {
    if (out.length >= MAX_FILES) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (out.length >= MAX_FILES) return;
      if (SKIP_DIR.has(e.name)) continue;
      const full = join(dir, e.name);
      const rel = relPrefix ? `${relPrefix}/${e.name}` : e.name;
      if (e.isDirectory()) { walk(full, rel); continue; }
      if (!e.isFile() || !SOURCE_EXT.test(e.name)) continue;
      try {
        out.push({ file: rel, content: readFileSync(full, 'utf8').slice(0, MAX_BYTES_PER_FILE) });
      } catch { /* skip */ }
    }
  }

  if (existsSync(scopeRoot)) walk(scopeRoot, '');
  return out;
}
