import { BaseDomainEvent } from '../../event-store/domain/base-domain-event';

export class CompendiumDescribed extends BaseDomainEvent {
  readonly type = 'CompendiumDescribed';

  constructor(params: {
    id: string;
    orgId: string;
    projectId: string;
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
      scope: null,
      parentId: params.parentId,
      title: params.title,
      meta: params.meta,
    });
  }
}
