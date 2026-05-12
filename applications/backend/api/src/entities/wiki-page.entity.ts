import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Project } from './project.entity';

@Entity('wiki_pages')
@Index('idx_wiki_pages_project', ['projectId'])
@Index('idx_wiki_pages_category', ['projectId', 'category'])
export class WikiPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  project: Project;

  @Column()
  slug: string;

  @Column()
  category: string;

  @Column()
  title: string;

  @Column('text')
  content: string;

  @Column('text', { array: true, default: '{}' })
  sources: string[];

  @Column('text', { array: true, default: '{}' })
  related: string[];

  @UpdateDateColumn()
  updatedAt: Date;
}
