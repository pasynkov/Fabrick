import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export interface Scope {
  kind: 'app' | 'lib' | 'root';
  name: string;
  root: string;
}

export function detectScopes(repoRoot: string): Scope[] {
  const out: Scope[] = [];

  const nestCliPath = join(repoRoot, 'nest-cli.json');
  if (existsSync(nestCliPath)) {
    try {
      const cfg = JSON.parse(readFileSync(nestCliPath, 'utf8'));
      if (cfg.monorepo && cfg.projects && typeof cfg.projects === 'object') {
        for (const [projectName, project] of Object.entries(cfg.projects as Record<string, { root?: string; type?: string }>)) {
          if (!project?.root) continue;
          out.push({ kind: project.type === 'library' ? 'lib' : 'app', name: projectName, root: project.root });
        }
        for (const lib of discoverLibs(repoRoot)) {
          if (!out.some((s) => s.root === lib.root)) out.push(lib);
        }
        return dedupeAndSort(out);
      }
    } catch { /* ignore */ }
  }

  const kustomization = tryKustomization(repoRoot);
  if (kustomization.length) return dedupeAndSort(kustomization);

  const fallback = tryAppsLibsLayout(repoRoot);
  if (fallback.length) return dedupeAndSort(fallback);

  return [{ kind: 'root', name: repoRoot.split('/').pop() || 'root', root: '.' }];
}

function discoverLibs(repoRoot: string): Scope[] {
  const libsDir = join(repoRoot, 'libs');
  if (!existsSync(libsDir)) return [];
  const out: Scope[] = [];
  for (const entry of safeReaddir(libsDir)) {
    const sub = join(libsDir, entry);
    if (!isDir(sub)) continue;
    out.push({ kind: 'lib', name: entry, root: `libs/${entry}` });
  }
  return out;
}

function tryKustomization(repoRoot: string): Scope[] {
  const base = join(repoRoot, 'base', 'applications');
  if (!isDir(base)) {
    const appsDir = join(repoRoot, 'applications');
    if (!isDir(appsDir)) return [];
    return readAppLevel(appsDir, 'applications');
  }
  return readAppLevel(base, 'base/applications');
}

function readAppLevel(dir: string, prefix: string): Scope[] {
  const out: Scope[] = [];
  for (const top of safeReaddir(dir)) {
    const topPath = join(dir, top);
    if (!isDir(topPath)) continue;
    const topKust = join(topPath, 'kustomization.yaml');
    const subdirs = safeReaddir(topPath).filter((e) => isDir(join(topPath, e)));
    if (existsSync(topKust) && subdirs.length === 0) {
      out.push({ kind: 'app', name: top, root: `${prefix}/${top}` });
      continue;
    }
    for (const sub of subdirs) {
      const subPath = join(topPath, sub);
      if (existsSync(join(subPath, 'kustomization.yaml'))) {
        out.push({ kind: 'app', name: `${top}/${sub}`, root: `${prefix}/${top}/${sub}` });
      }
    }
  }
  return out;
}

function tryAppsLibsLayout(repoRoot: string): Scope[] {
  const out: Scope[] = [];
  const appsDir = join(repoRoot, 'apps');
  if (isDir(appsDir)) {
    for (const a of safeReaddir(appsDir)) {
      const ap = join(appsDir, a);
      if (!isDir(ap)) continue;
      if (existsSync(join(ap, 'package.json')) || existsSync(join(ap, 'src'))) {
        out.push({ kind: 'app', name: a, root: `apps/${a}` });
      }
    }
  }
  for (const lib of discoverLibs(repoRoot)) out.push(lib);
  return out;
}

function safeReaddir(p: string): string[] {
  try { return readdirSync(p); } catch { return []; }
}

function isDir(p: string): boolean {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

function dedupeAndSort(scopes: Scope[]): Scope[] {
  const seen = new Set<string>();
  const out: Scope[] = [];
  for (const s of scopes) {
    if (seen.has(s.root)) continue;
    seen.add(s.root);
    out.push(s);
  }
  return out.sort((a, b) => {
    if (a.kind !== b.kind) {
      if (a.kind === 'app') return -1;
      if (b.kind === 'app') return 1;
    }
    return a.name < b.name ? -1 : 1;
  });
}
