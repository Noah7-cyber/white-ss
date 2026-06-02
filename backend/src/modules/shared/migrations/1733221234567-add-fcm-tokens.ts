import { MigrationInterface, QueryRunner } from "typeorm";

export class addFcmTokens1733221234567 implements MigrationInterface {
    name = 'addFcmTokens1733221234567'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "fcmTokens" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "fcmTokens"`);
    }
}
