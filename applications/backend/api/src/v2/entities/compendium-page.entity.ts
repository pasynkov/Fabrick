import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('compendium_pages')
@Unique('uq_compendium_page', ['projectId', 'slug'])
@Index('idx_cp_project', ['projectId'])
export class CompendiumPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'org_id' })
  orgId: string;

  @Column({ type: 'uuid', name: 'project_id' })
  projectId: string;

  @Column({ type: 'text' })
  slug: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', array: true, default: '{}' })
  sources: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  related: string[];

  @Column({ type: 'jsonb', default: '{}' })
  frontmatter: Record<string, unknown>;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;
}
