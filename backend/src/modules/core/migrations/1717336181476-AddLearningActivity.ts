import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLearningActivity1717336181476 implements MigrationInterface {
    name = 'AddLearningActivity1717336181476'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "learning_activities" ("id" SERIAL NOT NULL, "title" character varying(255) NOT NULL, "description" text, "subjectId" integer, "schoolId" integer, "creatorId" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_406b0d91244e883df16cd16da65" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD "learningActivityId" integer`);
        await queryRunner.query(`ALTER TABLE "learning_activities" ADD CONSTRAINT "FK_287413d73b22cfec80b15da07c2" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "learning_activities" ADD CONSTRAINT "FK_a1e5dd13cc3a8c3d5a420b9e836" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "learning_activities" ADD CONSTRAINT "FK_b1a7d25e0a6d51c099b24403de0" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD CONSTRAINT "FK_c92b5b3a4a7541f92e9d21ebbc3" FOREIGN KEY ("learningActivityId") REFERENCES "learning_activities"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "milestones" DROP CONSTRAINT "FK_c92b5b3a4a7541f92e9d21ebbc3"`);
        await queryRunner.query(`ALTER TABLE "learning_activities" DROP CONSTRAINT "FK_b1a7d25e0a6d51c099b24403de0"`);
        await queryRunner.query(`ALTER TABLE "learning_activities" DROP CONSTRAINT "FK_a1e5dd13cc3a8c3d5a420b9e836"`);
        await queryRunner.query(`ALTER TABLE "learning_activities" DROP CONSTRAINT "FK_287413d73b22cfec80b15da07c2"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "learningActivityId"`);
        await queryRunner.query(`DROP TABLE "learning_activities"`);
    }

}
