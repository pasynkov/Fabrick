import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { WikiRepository, WikiPage, WikiPageData, WikiPageMeta, extractOneLiner } from '@app/shared';

const PAGES_DIR = join(process.cwd(), 'sandbox-data', 'pages');

function slugToPath(slug: string): string {
  return join(PAGES_DIR, `${slug}.md`);
}

function writeFrontmatter(page: WikiPageData): string {
  const sources = page.sources.map((s) => `  - ${s}`).join('\n');
  const related = page.related.map((r) => `  - ${r}`).join('\n');
  return `---\nslug: ${page.slug}\ncategory: ${page.category}\ntitle: ${page.title}\nsources:\n${sources || '  []'}\nrelated:\n${related || '  []'}\n---\n\n${page.content}\n`;
}

function parsePage(slug: string, raw: string): WikiPage | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;

  const yaml = match[1];
  const content = match[2].trim();

  const slugMatch = yaml.match(/^slug:\s*(.+)$/m);
  const categoryMatch = yaml.match(/^category:\s*(.+)$/m);
  const titleMatch = yaml.match(/^title:\s*(.+)$/m);

  const sourcesBlock = yaml.match(/^sources:\s*\n((?:\s+-\s+.+\n?)*)/m);
  const sourcesInline = yaml.match(/^sources:\s*\[([^\]]*)\]/m);
  let sources: string[] = [];
  if (sourcesBlock) {
    sources = sourcesBlock[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
  } else if (sourcesInline) {
    sources = sourcesInline[1].split(',').map((s) => s.trim()).filter(Boolean);
  }

  const relatedBlock = yaml.match(/^related:\s*\n((?:\s+-\s+.+\n?)*)/m);
  const relatedInline = yaml.match(/^related:\s*\[([^\]]*)\]/m);
  let related: string[] = [];
  if (relatedBlock) {
    related = relatedBlock[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
  } else if (relatedInline) {
    related = relatedInline[1].split(',').map((s) => s.trim()).filter(Boolean);
  }

  return {
    slug: slugMatch?.[1]?.trim() ?? slug,
    category: categoryMatch?.[1]?.trim() ?? 'overview',
    title: titleMatch?.[1]?.trim() ?? slug,
    content,
    sources,
    related,
  };
}

function walkMdFiles(dir: string, results: string[] = []): string[] {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMdFiles(full, results);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

function pathToSlug(filePath: string): string {
  const rel = filePath.slice(PAGES_DIR.length + 1);
  return rel.replace(/\.md$/, '').replace(/\\/g, '/');
}

@Injectable()
export class FsWikiRepository implements WikiRepository {
  async findBySlug(_projectId: string, slug: string): Promise<WikiPage | null> {
    const filePath = slugToPath(slug);
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, 'utf-8');
    return parsePage(slug, raw);
  }

  async findBySlugs(_projectId: string, slugs: string[]): Promise<WikiPage[]> {
    const results: WikiPage[] = [];
    for (const slug of slugs) {
      const page = await this.findBySlug(_projectId, slug);
      if (page) results.push(page);
    }
    return results;
  }

  async findByProject(_projectId: string): Promise<WikiPage[]> {
    const files = walkMdFiles(PAGES_DIR);
    const results: WikiPage[] = [];
    for (const filePath of files) {
      const slug = pathToSlug(filePath);
      const raw = readFileSync(filePath, 'utf-8');
      const page = parsePage(slug, raw);
      if (page) results.push(page);
    }
    return results;
  }

  async findCategories(projectId: string): Promise<string[]> {
    const pages = await this.findByProject(projectId);
    return Array.from(new Set(pages.map((p) => p.category)));
  }

  async findByCategory(projectId: string, category: string): Promise<WikiPageMeta[]> {
    const pages = await this.findByProject(projectId);
    return pages
      .filter((p) => p.category === category)
      .map((p) => ({ slug: p.slug, title: p.title, one_liner: extractOneLiner(p.content) }));
  }

  async upsert(_projectId: string, pages: WikiPageData[]): Promise<void> {
    for (const page of pages) {
      const filePath = slugToPath(page.slug);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, writeFrontmatter(page), 'utf-8');
    }
  }

  async delete(_projectId: string, slugs: string[]): Promise<void> {
    for (const slug of slugs) {
      const filePath = slugToPath(slug);
      if (existsSync(filePath)) unlinkSync(filePath);
    }
  }
}
