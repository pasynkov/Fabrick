import { BaseDomainEvent } from '../../event-store/domain/base-domain-event';

export class CompendiumUpdated extends BaseDomainEvent {
  readonly type = 'CompendiumUpdated';

  constructor(params: {
    id: string;
    orgId: string;
    projectId: string;
    parentId: string;
    title: string;
    meta: {
      repos: string[];
      totalCostUsd: number;
    };
  }) {
    super({
      id: params.id,
      orgId: params.orgId,
      projectId: params.projectId,
      scope: null,
      parentId: params.parentId,
      title: params.title,
      meta: params.meta,
    });
  }
}
