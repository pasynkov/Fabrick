import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum ApiKeyAuditAction {
  SET = 'set',
  UPDATE = 'update',
  DELETE = 'delete',
  USE = 'use',
  DECRYPT_FAILED = 'decrypt_failed',
  VALIDATION_FAILED = 'validation_failed',
}

export enum ApiKeyAuditLevel {
  ORGANIZATION = 'organization',
  PROJECT = 'project',
}

@Entity('api_key_audit_logs')
export class ApiKeyAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'varchar', length: 20 })
  level: string;

  @Column({ nullable: true, type: 'uuid' })
  organizationId: string | null;

  @Column({ nullable: true, type: 'uuid' })
  projectId: string | null;

  @Column()
  userId: string;

  @Column({ length: 16 })
  keyHash: string;

  @Column({ nullable: true, type: 'text' })
  details: string | null;

  @Column({ nullable: true, length: 45 })
  ipAddress: string | null;

  @Column({ nullable: true, type: 'text' })
  userAgent: string | null;

  @CreateDateColumn()
  timestamp: Date;
}
