import { ProjectEvent } from '../../entities/project-event.entity';

export abstract class BaseDomainEvent {
  readonly id: string;
  abstract readonly type: string;

  readonly orgId: string;
  readonly projectId: string | null;
  readonly repoId: string | null;
  readonly scope: string | null;
  readonly parentId: string | null;
  readonly title: string | null;
  readonly bodies: Record<string, string> | null;
  readonly instructions: string | null;
  readonly meta: Record<string, unknown>;
  readonly baseSha: string | null;
  readonly headSha: string | null;
  readonly prNumber: number | null;

  constructor(params: {
    id: string;
    orgId: string;
    projectId?: string | null;
    repoId?: string | null;
    scope?: string | null;
    parentId?: string | null;
    title?: string | null;
    bodies?: Record<string, string> | null;
    instructions?: string | null;
    meta?: Record<string, unknown>;
    baseSha?: string | null;
    headSha?: string | null;
    prNumber?: number | null;
  }) {
    this.id = params.id;
    this.orgId = params.orgId;
    this.projectId = params.projectId ?? null;
    this.repoId = params.repoId ?? null;
    this.scope = params.scope ?? null;
    this.parentId = params.parentId ?? null;
    this.title = params.title ?? null;
    this.bodies = params.bodies ?? null;
    this.instructions = params.instructions ?? null;
    this.meta = params.meta ?? {};
    this.baseSha = params.baseSha ?? null;
    this.headSha = params.headSha ?? null;
    this.prNumber = params.prNumber ?? null;
  }

  toEntity(): ProjectEvent {
    const entity = new ProjectEvent();
    entity.id = this.id;
    entity.type = this.type;
    entity.orgId = this.orgId;
    entity.projectId = this.projectId;
    entity.repoId = this.repoId;
    entity.scope = this.scope;
    entity.parentId = this.parentId;
    entity.title = this.title;
    entity.bodies = this.bodies;
    entity.instructions = this.instructions;
    entity.meta = this.meta;
    entity.baseSha = this.baseSha;
    entity.headSha = this.headSha;
    entity.prNumber = this.prNumber;
    return entity;
  }
}
