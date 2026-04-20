import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Organization } from './organization.entity';

@Entity('projects')
@Unique(['orgId', 'slug'])
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  slug: string;

  @Column()
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  org: Organization;

  @Column({ default: 'idle' })
  synthStatus: string;

  @Column({ nullable: true, type: 'text' })
  synthError: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
