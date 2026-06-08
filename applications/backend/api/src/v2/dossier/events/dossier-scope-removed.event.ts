import { BaseDomainEvent } from '../../event-store/domain/base-domain-event';

export class DossierScopeRemoved extends BaseDomainEvent {
  readonly type = 'DossierScopeRemoved';

  constructor(params: {
    id: string;
    orgId: string;
    projectId: string;
    repoId: string;
    scope: string;
    parentId: string;
    meta: {
      lastKnownSlugs: string[];
    };
  }) {
    super({
      id: params.id,
      orgId: params.orgId,
      projectId: params.projectId,
      repoId: params.repoId,
      scope: params.scope,
      parentId: params.parentId,
      title: `removed scope ${params.scope}`,
      meta: params.meta,
    });
  }
}
