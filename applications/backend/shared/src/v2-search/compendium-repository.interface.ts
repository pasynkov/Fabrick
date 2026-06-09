export const COMPENDIUM_REPOSITORY = 'COMPENDIUM_REPOSITORY';

export interface CompendiumPage {
  slug: string;
  content: string;
}

export interface CompendiumRepository {
  findIndex(projectId: string): Promise<CompendiumPage | null>;
  findBySlug(projectId: string, slug: string): Promise<CompendiumPage | null>;
}
