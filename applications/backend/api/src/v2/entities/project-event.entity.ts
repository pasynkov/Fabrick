import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('project_events')
@Index('idx_pe_org_at', ['orgId', 'at'])
@Index('idx_pe_project_at', ['projectId', 'at'])
@Index('idx_pe_repo_at', ['repoId', 'at'])
@Index('idx_pe_repo_scope_at', ['repoId', 'scope', 'at'])
@Index('idx_pe_parent', ['parentId'])
@Index('idx_pe_type_at', ['type', 'at'])
export class ProjectEvent {
  @PrimaryColumn({ type: 'char', length: 26 })
  id: string;

  @Column({ type: 'uuid', name: 'org_id' })
  orgId: string;

  @Column({ type: 'uuid', name: 'project_id', nullable: true })
  projectId: string | null;

  @Column({ type: 'uuid', name: 'repo_id', nullable: true })
  repoId: string | null;

  @Column({ type: 'text', nullable: true })
  scope: string | null;

  @Column({ type: 'text' })
  type: string;

  @Column({ type: 'char', length: 26, name: 'parent_id', nullable: true })
  parentId: string | null;

  @Column({ type: 'text', name: 'base_sha', nullable: true })
  baseSha: string | null;

  @Column({ type: 'text', name: 'head_sha', nullable: true })
  headSha: string | null;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'jsonb', nullable: true })
  bodies: Record<string, string> | null;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  meta: Record<string, unknown>;

  @Column({ type: 'int', name: 'pr_number', nullable: true })
  prNumber: number | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  at: Date;
}
