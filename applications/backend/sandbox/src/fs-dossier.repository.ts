import { Injectable } from '@nestjs/common';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { DossierRepository, DossierPage, DossierPageRef } from '@app/shared';

const DOSSIERS_DIR = join(process.cwd(), 'sandbox-data', 'dossiers');

function extractTitle(content: string, fallback: string): string {
  if (content.startsWith('---')) {
    const end = content.indexOf('\n---', 3);
    if (end !== -1) {
      const yaml = content.slice(3, end);
      const match = yaml.match(/^title:\s*(.+)$/m);
      if (match) return match[1].trim();
    }
  }
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return fallback;
}

function extractOneLiner(content: string): string {
  let body = content;
  if (body.startsWith('---')) {
    const end = body.indexOf('\n---', 3);
    if (end !== -1) body = body.slice(end + 4);
  }
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  let start = 0;
  if (lines[0]?.startsWith('#')) start = 1;
  return (lines[start] ?? '').slice(0, 200);
}

@Injectable()
export class FsDossierRepository implements DossierRepository {
  async listScopes(_projectId: string, repoSlug: string): Promise<Array<{ scope: string; pageCount: number }>> {
    const repoDir = join(DOSSIERS_DIR, repoSlug);
    if (!existsSync(repoDir)) return [];

    const scopeMap = new Map<string, number>();
    for (const entry of readdirSync(repoDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const scopeDir = join(repoDir, entry.name);
        const files = readdirSync(scopeDir).filter((f) => f.endsWith('.md'));
        scopeMap.set(entry.name, files.length);
      }
    }
    return Array.from(scopeMap.entries()).map(([scope, pageCount]) => ({ scope, pageCount }));
  }

  async listInScope(
    _projectId: string,
    repoSlug: string,
    scope: string,
  ): Promise<Array<{ slug: string; title: string; oneLiner: string }>> {
    const scopeDir = join(DOSSIERS_DIR, repoSlug, scope);
    if (!existsSync(scopeDir)) return [];

    const results: Array<{ slug: string; title: string; oneLiner: string }> = [];
    for (const entry of readdirSync(scopeDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const slug = entry.name.replace(/\.md$/, '');
        const content = readFileSync(join(scopeDir, entry.name), 'utf-8');
        results.push({
          slug,
          title: extractTitle(content, slug),
          oneLiner: extractOneLiner(content),
        });
      }
    }
    return results;
  }

  async findPage(
    _projectId: string,
    repoSlug: string,
    scope: string,
    slug: string,
  ): Promise<DossierPage | null> {
    const filePath = join(DOSSIERS_DIR, repoSlug, scope, `${slug}.md`);
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, 'utf-8');
    return { repoSlug, scope, slug, content };
  }

  async findPages(_projectId: string, refs: DossierPageRef[]): Promise<DossierPage[]> {
    const results: DossierPage[] = [];
    for (const ref of refs) {
      const page = await this.findPage(_projectId, ref.repoSlug, ref.scope, ref.slug);
      if (page) results.push(page);
    }
    return results;
  }

  /**
   * Walk all pages under dossiers directory.
   * Used by synthesize-v2 to inspect what's been written.
   */
  walkAll(): Array<{ repoSlug: string; scope: string; slug: string }> {
    if (!existsSync(DOSSIERS_DIR)) return [];
    const results: Array<{ repoSlug: string; scope: string; slug: string }> = [];
    for (const repoEntry of readdirSync(DOSSIERS_DIR, { withFileTypes: true })) {
      if (!repoEntry.isDirectory()) continue;
      const repoSlug = repoEntry.name;
      const repoDir = join(DOSSIERS_DIR, repoSlug);
      for (const scopeEntry of readdirSync(repoDir, { withFileTypes: true })) {
        if (!scopeEntry.isDirectory()) continue;
        const scope = scopeEntry.name;
        const scopeDir = join(repoDir, scope);
        for (const fileEntry of readdirSync(scopeDir, { withFileTypes: true })) {
          if (fileEntry.isFile() && fileEntry.name.endsWith('.md')) {
            results.push({ repoSlug, scope, slug: fileEntry.name.replace(/\.md$/, '') });
          }
        }
      }
    }
    return results;
  }
}
