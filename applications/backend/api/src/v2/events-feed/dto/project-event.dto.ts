import { ProjectEvent } from '../../entities/project-event.entity';

export class ProjectEventDto {
  id: string;
  type: string;
  parentId: string | null;
  orgId: string;
  projectId: string | null;
  repoId: string | null;
  scope: string | null;
  title: string | null;
  baseSha: string | null;
  headSha: string | null;
  prNumber: number | null;
  bodies: Record<string, string> | null;
  instructions: string | null;
  meta: Record<string, unknown>;
  at: string;

  static fromEntity(entity: ProjectEvent): ProjectEventDto {
    const dto = new ProjectEventDto();
    dto.id = entity.id;
    dto.type = entity.type;
    dto.parentId = entity.parentId;
    dto.orgId = entity.orgId;
    dto.projectId = entity.projectId;
    dto.repoId = entity.repoId;
    dto.scope = entity.scope;
    dto.title = entity.title;
    dto.baseSha = entity.baseSha;
    dto.headSha = entity.headSha;
    dto.prNumber = entity.prNumber;
    dto.bodies = entity.bodies;
    dto.instructions = entity.instructions;
    dto.meta = entity.meta;
    dto.at = entity.at instanceof Date ? entity.at.toISOString() : entity.at;
    return dto;
  }
}
