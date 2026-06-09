import { BaseDomainEvent } from '../../event-store/domain/base-domain-event';

export class DossierPatchComputed extends BaseDomainEvent {
  readonly type = 'DossierPatchComputed';

  constructor(params: {
    id: string;
    orgId: string;
    projectId: string;
    repoId: string;
    scope: string;
    parentId: string;
    instructions: string;
    meta: {
      model: string;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      changedSlugs: string[];
    };
  }) {
    super({
      id: params.id,
      orgId: params.orgId,
      projectId: params.projectId,
      repoId: params.repoId,
      scope: params.scope,
      parentId: params.parentId,
      instructions: params.instructions,
      meta: params.meta,
    });
  }
}
