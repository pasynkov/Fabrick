import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('prompt_revisions')
@Unique('uq_prompt_revisions_name_agent_revision', ['name', 'agent', 'revision'])
@Index('idx_prompt_revisions_name_agent_revision_desc', ['name', 'agent', 'revision'])
export class PromptRevision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar')
  name: string;

  @Column('varchar')
  agent: string;

  @Column('int')
  revision: number;

  @Column({ type: 'jsonb' })
  content: { files: Record<string, string> };

  @Column('text', { nullable: true })
  note: string | null;

  @Column('varchar', { nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
