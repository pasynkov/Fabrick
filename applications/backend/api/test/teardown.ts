import { DataSource } from 'typeorm';

export default async function globalTeardown() {
  const testDb = process.env.DB_TEST_NAME || 'fabrick_test';
  const adminDs = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: 'postgres',
    username: process.env.DB_USER || 'fabrick',
    password: process.env.DB_PASS || 'fabrick',
  });
  await adminDs.initialize();
  await adminDs.query(`DROP DATABASE IF EXISTS ${testDb}`);
  await adminDs.destroy();
}
