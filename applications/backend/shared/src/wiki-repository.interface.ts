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

export interface WikiRepository {
  findBySlug(projectId: string, slug: string): Promise<WikiPage | null>;
  findBySlugs(projectId: string, slugs: string[]): Promise<WikiPage[]>;
  findByProject(projectId: string): Promise<WikiPage[]>;
  upsert(projectId: string, pages: WikiPageData[]): Promise<void>;
  delete(projectId: string, slugs: string[]): Promise<void>;
}
