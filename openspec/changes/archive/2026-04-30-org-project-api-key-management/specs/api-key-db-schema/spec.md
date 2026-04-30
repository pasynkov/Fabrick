# Database Schema for API Key Management

## Overview
Add encrypted anthropicApiKey columns to the Organization and Project entities to support hierarchical API key management while maintaining backward compatibility.

## Database Changes

### Organizations Table
```sql
-- Add encrypted anthropicApiKey column
ALTER TABLE organizations 
ADD COLUMN anthropicApiKey TEXT NULL;

-- Index for faster lookups during key resolution
CREATE INDEX idx_organizations_api_key ON organizations(anthropicApiKey) WHERE anthropicApiKey IS NOT NULL;
```

### Projects Table
```sql
-- Add encrypted anthropicApiKey column  
ALTER TABLE projects 
ADD COLUMN anthropicApiKey TEXT NULL;

-- Index for faster lookups during key resolution
CREATE INDEX idx_projects_api_key ON projects(anthropicApiKey) WHERE anthropicApiKey IS NOT NULL;
```

## TypeORM Entity Updates

### Organization Entity
```typescript
// applications/backend/api/src/entities/organization.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true, type: 'text' })
  anthropicApiKey: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
```

### Project Entity
```typescript
// applications/backend/api/src/entities/project.entity.ts
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

  @Column({ nullable: true, type: 'text' })
  anthropicApiKey: string | null;

  @Column({ default: 'idle' })
  synthStatus: string;

  @Column({ nullable: true, type: 'text' })
  synthError: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
```

## Migration File
```typescript
// applications/backend/api/src/migrations/1745100000000-AddApiKeys.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApiKeys1745100000000 implements MigrationInterface {
  name = 'AddApiKeys1745100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "organizations" ADD "anthropicApiKey" text`);
    await queryRunner.query(`ALTER TABLE "projects" ADD "anthropicApiKey" text`);
    
    await queryRunner.query(`CREATE INDEX "idx_organizations_api_key" ON "organizations" ("anthropicApiKey") WHERE "anthropicApiKey" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX "idx_projects_api_key" ON "projects" ("anthropicApiKey") WHERE "anthropicApiKey" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_projects_api_key"`);
    await queryRunner.query(`DROP INDEX "idx_organizations_api_key"`);
    
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "anthropicApiKey"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "anthropicApiKey"`);
  }
}
```

## Data Considerations

- **Encryption**: All API key values stored in the database will be encrypted using AES-256-GCM with the global ANTHROPIC_API_KEY as the encryption key
- **Nullable columns**: Both columns are nullable. Existing organizations/projects will have NULL values initially; synthesis is blocked for those without a configured key until one is set
- **Indexing**: Partial indexes on non-null values optimize key resolution queries
- **Text type**: Using TEXT type to accommodate encrypted string length variations

## Security Considerations

- API keys are never stored in plaintext in the database
- The encryption key (global ANTHROPIC_API_KEY) is stored securely as an environment variable
- Database backups will contain encrypted data only
- Application-level decryption is required to use stored keys