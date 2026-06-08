import { BaseDomainEvent } from '../../event-store/domain/base-domain-event';

export class CompendiumRegenApplied extends BaseDomainEvent {
  readonly type = 'CompendiumRegenApplied';

  constructor(params: {
    id: string;
    orgId: string;
    projectId: string;
    parentId: string;
    bodies: Record<string, string>;
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
      bodies: params.bodies,
      meta: params.meta,
    });
  }
}
