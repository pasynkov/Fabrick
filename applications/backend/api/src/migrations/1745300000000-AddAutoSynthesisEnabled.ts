import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAutoSynthesisEnabled1745300000000 implements MigrationInterface {
  name = 'AddAutoSynthesisEnabled1745300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" ADD COLUMN "autoSynthesisEnabled" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "autoSynthesisEnabled"`);
  }
}
