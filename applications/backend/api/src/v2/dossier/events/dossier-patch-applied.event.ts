import { BaseDomainEvent } from '../../event-store/domain/base-domain-event';

export class DossierPatchApplied extends BaseDomainEvent {
  readonly type = 'DossierPatchApplied';

  constructor(params: {
    id: string;
    orgId: string;
    projectId: string;
    repoId: string;
    scope: string;
    parentId: string;
    title: string;
    bodies: Record<string, string>;
    meta: {
      sources: string[];
      slugCounts: Record<string, number>;
      sample: string;
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
      bodies: params.bodies,
      meta: params.meta,
    });
  }
}
