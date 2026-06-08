import { BaseDomainEvent } from '../../event-store/domain/base-domain-event';

export class CompendiumRegenFired extends BaseDomainEvent {
  readonly type = 'CompendiumRegenFired';

  constructor(params: {
    id: string;
    orgId: string;
    projectId: string;
    parentId: string;
    bundleRef: { container: string; key: string; hash: string };
    repos: string[];
    dossierUpdatedId: string;
  }) {
    super({
      id: params.id,
      orgId: params.orgId,
      projectId: params.projectId,
      scope: null,
      parentId: params.parentId,
      meta: {
        bundleRef: params.bundleRef,
        repos: params.repos,
        dossierUpdatedId: params.dossierUpdatedId,
      },
    });
  }
}
