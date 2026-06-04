import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Detect wiki scopes inside a repository.
 *
 * Returns: [{ kind: 'app' | 'lib' | 'root', name, root }]
 *   - kind = 'app': a deployable microservice (its own NestJS app, etc.)
 *   - kind = 'lib': a shared library
 *   - kind = 'root': the whole repo (single-project fallback)
 *
 * `root` is the path RELATIVE to the repo root.
 *
 * Resolution order:
 *   1. nest-cli.json projects map (NestJS monorepo) → apps + auto-discover libs/
 *   2. pnpm-workspace.yaml / package.json workspaces / nx.json (future)
 *   3. fallback: { kind: 'root', name: <basename>, root: '.' }
 */
export function detectScopes(repoRoot) {
  const out = [];

  const nestCliPath = join(repoRoot, 'nest-cli.json');
  if (existsSync(nestCliPath)) {
    try {
      const cfg = JSON.parse(readFileSync(nestCliPath, 'utf8'));
      if (cfg.monorepo && cfg.projects && typeof cfg.projects === 'object') {
        for (const [projectName, project] of Object.entries(cfg.projects)) {
          if (!project?.root) continue;
          out.push({
            kind: project.type === 'library' ? 'lib' : 'app',
            name: projectName,
            root: project.root,
          });
        }
        // Auto-detect libs/ even if not in nest-cli.json projects
        for (const lib of discoverLibs(repoRoot)) {
          if (!out.some((s) => s.root === lib.root)) out.push(lib);
        }
        return dedupeAndSort(out);
      }
    } catch { /* ignore */ }
  }

  // Try Kubernetes/kustomize style: every directory containing kustomization.yaml
  // counts as an "app" (deployable unit).
  const kustomization = tryKustomization(repoRoot);
  if (kustomization.length) return dedupeAndSort(kustomization);

  // Try classic apps/* + libs/* layout without nest-cli
  const fallback = tryAppsLibsLayout(repoRoot);
  if (fallback.length) return dedupeAndSort(fallback);

  // Single project
  return [{ kind: 'root', name: repoRoot.split('/').pop() || 'root', root: '.' }];
}

function discoverLibs(repoRoot) {
  const libsDir = join(repoRoot, 'libs');
  if (!existsSync(libsDir)) return [];
  const out = [];
  for (const entry of safeReaddir(libsDir)) {
    const sub = join(libsDir, entry);
    if (!isDir(sub)) continue;
    out.push({ kind: 'lib', name: entry, root: `libs/${entry}` });
  }
  return out;
}

function tryKustomization(repoRoot) {
  // Walk and find every directory that has kustomization.yaml.
  // For our test repos: kustomize repo has nested kustomization.yaml — treat
  // each level-1 application directory as a scope.
  const base = join(repoRoot, 'base', 'applications');
  if (!isDir(base)) {
    // top-level applications directory?
    const appsDir = join(repoRoot, 'applications');
    if (!isDir(appsDir)) return [];
    return readAppLevel(appsDir, 'applications');
  }
  return readAppLevel(base, 'base/applications');
}

function readAppLevel(dir, prefix) {
  const out = [];
  for (const top of safeReaddir(dir)) {
    const topPath = join(dir, top);
    if (!isDir(topPath)) continue;
    // For each first-level dir (assets/, harvester/, …) gather either the dir
    // itself if it has kustomization.yaml, or its subdirs.
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

function tryAppsLibsLayout(repoRoot) {
  const out = [];
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

function safeReaddir(p) {
  try { return readdirSync(p); }
  catch { return []; }
}

function isDir(p) {
  try { return statSync(p).isDirectory(); }
  catch { return false; }
}

function dedupeAndSort(scopes) {
  const seen = new Set();
  const out = [];
  for (const s of scopes) {
    const key = s.root;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.sort((a, b) => {
    if (a.kind !== b.kind) {
      // apps before libs
      if (a.kind === 'app') return -1;
      if (b.kind === 'app') return 1;
    }
    return a.name < b.name ? -1 : 1;
  });
}
