import { WikiPageData } from './wiki-page.types';

export const WIKI_REPOSITORY = Symbol('WIKI_REPOSITORY');

export interface WikiPage {
  slug: string;
  category: string;
  title: string;
  content: string;
  sources: string[];
  related: string[];
}

export interface WikiPageMeta {
  slug: string;
  title: string;
  one_liner: string;
}

export function extractOneLiner(content: string): string {
  const lines = content.split(/\r?\n/);
  let pastTitle = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!pastTitle && /^#\s+/.test(trimmed)) {
      pastTitle = true;
      continue;
    }
    return trimmed;
  }
  return '';
}

export interface WikiRepository {
  findBySlug(projectId: string, slug: string): Promise<WikiPage | null>;
  findBySlugs(projectId: string, slugs: string[]): Promise<WikiPage[]>;
  findByProject(projectId: string): Promise<WikiPage[]>;
  findCategories(projectId: string): Promise<string[]>;
  findByCategory(projectId: string, category: string): Promise<WikiPageMeta[]>;
  upsert(projectId: string, pages: WikiPageData[]): Promise<void>;
  delete(projectId: string, slugs: string[]): Promise<void>;
}
