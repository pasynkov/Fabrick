import { DataSource } from 'typeorm';
import { migrations } from '../src/migrations';
import { User } from '../src/entities/user.entity';
import { Organization } from '../src/entities/organization.entity';
import { OrgMember } from '../src/entities/org-member.entity';
import { Project } from '../src/entities/project.entity';
import { Repository } from '../src/entities/repository.entity';

const host = process.env.DB_HOST || 'localhost';
const port = parseInt(process.env.DB_PORT || '5432', 10);
const username = process.env.DB_USER || 'fabrick';
const password = process.env.DB_PASS || 'fabrick';
const testDb = process.env.DB_TEST_NAME || 'fabrick_test';

export default async function globalSetup() {
  const adminDs = new DataSource({
    type: 'postgres',
    host,
    port,
    database: 'postgres',
    username,
    password,
  });
  await adminDs.initialize();
  await adminDs.query(`DROP DATABASE IF EXISTS ${testDb}`);
  await adminDs.query(`CREATE DATABASE ${testDb}`);
  await adminDs.destroy();

  const ds = new DataSource({
    type: 'postgres',
    host,
    port,
    database: testDb,
    username,
    password,
    entities: [User, Organization, OrgMember, Project, Repository],
    migrations,
  });
  await ds.initialize();
  await ds.runMigrations();
  await ds.destroy();
}
