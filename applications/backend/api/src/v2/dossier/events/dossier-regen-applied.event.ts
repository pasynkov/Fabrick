import { BaseDomainEvent } from '../../event-store/domain/base-domain-event';

export class DossierRegenApplied extends BaseDomainEvent {
  readonly type = 'DossierRegenApplied';

  constructor(params: {
    id: string;
    orgId: string;
    projectId: string;
    repoId: string;
    scope: string;
    parentId: string;
    bodies: Record<string, string>;
    meta: {
      reason: 'auto' | 'forced' | 'genesis';
      sources: string[];
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
      bodies: params.bodies,
      meta: params.meta,
    });
  }
}
