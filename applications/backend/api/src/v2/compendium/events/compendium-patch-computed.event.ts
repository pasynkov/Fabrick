import { BaseDomainEvent } from '../../event-store/domain/base-domain-event';

export class CompendiumPatchComputed extends BaseDomainEvent {
  readonly type = 'CompendiumPatchComputed';

  constructor(params: {
    id: string;
    orgId: string;
    projectId: string;
    parentId: string;
    instructions: string;
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
      instructions: params.instructions,
      meta: params.meta,
    });
  }
}
