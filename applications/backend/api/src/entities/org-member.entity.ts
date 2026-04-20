import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { Organization } from './organization.entity';
import { User } from './user.entity';

export type OrgRole = 'admin' | 'member';

@Entity('org_members')
export class OrgMember {
  @PrimaryColumn()
  orgId: string;

  @PrimaryColumn()
  userId: string;

  @Column({ type: 'varchar' })
  role: OrgRole;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  org: Organization;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;
}
