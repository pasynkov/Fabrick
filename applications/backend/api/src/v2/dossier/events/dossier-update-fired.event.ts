import { BaseDomainEvent } from '../../event-store/domain/base-domain-event';

export class DossierUpdateFired extends BaseDomainEvent {
  readonly type = 'DossierUpdateFired';

  constructor(params: {
    id: string;
    orgId: string;
    projectId: string;
    repoId: string;
    baseSha: string;
    headSha: string;
    prTitle?: string;
    prNumber?: number;
  }) {
    super({
      id: params.id,
      orgId: params.orgId,
      projectId: params.projectId,
      repoId: params.repoId,
      scope: null,
      parentId: null,
      baseSha: params.baseSha,
      headSha: params.headSha,
      prNumber: params.prNumber ?? null,
      meta: {
        baseSha: params.baseSha,
        headSha: params.headSha,
        ...(params.prTitle !== undefined && { prTitle: params.prTitle }),
        ...(params.prNumber !== undefined && { prNumber: params.prNumber }),
      },
    });
  }
}
