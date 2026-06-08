import { BaseDomainEvent } from '../../event-store/domain/base-domain-event';

export class DossierRegenDescribed extends BaseDomainEvent {
  readonly type = 'DossierRegenDescribed';

  constructor(params: {
    id: string;
    orgId: string;
    projectId: string;
    repoId: string;
    scope: string;
    parentId: string;
    title: string;
    meta: {
      model: string;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
    };
  }) {
    super({
      id: params.id,
      orgId: params.orgId,
      projectId: params.projectId,
      repoId: params.repoId,
      scope: params.scope,
      parentId: params.parentId,
      title: params.title,
      meta: params.meta,
    });
  }
}
