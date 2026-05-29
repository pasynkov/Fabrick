import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Project } from './project.entity';
import { SearchRequest } from './search-request.entity';

@Entity('token_usage')
@Index('idx_token_usage_project_created', ['projectId', 'createdAt'])
export class TokenUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  project: Project;

  @Column('uuid', { nullable: true })
  searchRequestId: string | null;

  @ManyToOne(() => SearchRequest, { onDelete: 'SET NULL', nullable: true })
  searchRequest: SearchRequest | null;

  @Column('varchar')
  operation: string;

  @Column('int')
  inputTokens: number;

  @Column('int')
  outputTokens: number;

  @Column('varchar')
  provider: string;

  @CreateDateColumn()
  createdAt: Date;
}
