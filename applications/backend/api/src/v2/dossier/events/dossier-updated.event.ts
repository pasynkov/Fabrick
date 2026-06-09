import { BaseDomainEvent } from '../../event-store/domain/base-domain-event';

export class DossierUpdated extends BaseDomainEvent {
  readonly type = 'DossierUpdated';

  constructor(params: {
    id: string;
    orgId: string;
    projectId: string;
    repoId: string;
    parentId: string;
    title: string;
    baseSha: string;
    headSha: string;
    prNumber?: number;
    meta: {
      totalCostUsd: number;
      scopes: Array<{ name: string; mode: string }>;
    };
  }) {
    super({
      id: params.id,
      orgId: params.orgId,
      projectId: params.projectId,
      repoId: params.repoId,
      scope: null,
      parentId: params.parentId,
      title: params.title,
      baseSha: params.baseSha,
      headSha: params.headSha,
      prNumber: params.prNumber ?? null,
      meta: params.meta,
    });
  }
}
