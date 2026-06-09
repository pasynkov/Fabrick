export const DOSSIER_REPOSITORY = 'DOSSIER_REPOSITORY';

export interface DossierPageRef {
  repoSlug: string;
  scope: string;
  slug: string;
}

export interface DossierPage extends DossierPageRef {
  content: string;
}

export interface DossierRepository {
  listScopes(projectId: string, repoSlug: string): Promise<Array<{ scope: string; pageCount: number }>>;
  listInScope(
    projectId: string,
    repoSlug: string,
    scope: string,
  ): Promise<Array<{ slug: string; title: string; oneLiner: string }>>;
  findPage(
    projectId: string,
    repoSlug: string,
    scope: string,
    slug: string,
  ): Promise<DossierPage | null>;
  findPages(
    projectId: string,
    refs: DossierPageRef[],
  ): Promise<DossierPage[]>;
}
