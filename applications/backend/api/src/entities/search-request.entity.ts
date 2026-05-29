import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Project } from './project.entity';

@Entity('search_requests')
@Index('idx_search_requests_project_created', ['projectId', 'createdAt'])
export class SearchRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  project: Project;

  @Column('text')
  question: string;

  @Column({ default: false })
  reasoningRequested: boolean;

  @Column('int')
  iters: number;

  @Column('int')
  pagesRead: number;

  @Column('int')
  totalInputTokens: number;

  @Column('int')
  totalOutputTokens: number;

  @Column('int')
  durationMs: number;

  @Column('varchar')
  stopReason: string;

  @Column('text')
  answerBrief: string;

  @Column('text', { nullable: true })
  answerReasoning: string | null;

  @Column('text', { array: true, default: '{}' })
  sources: string[];

  @CreateDateColumn()
  createdAt: Date;
}
