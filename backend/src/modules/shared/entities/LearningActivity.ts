import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm";
import { Subject } from "./Subject";
import { Milestone } from "./Milestone";
import { School } from "./School";
import { User } from "./User";

@Entity('learning_activities')
export class LearningActivity {
  constructor(data?: Partial<LearningActivity>) {
    if (typeof data === "object" && data !== null) {
      Object.assign(this, data);
    }
  }

  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'int', nullable: true })
  subjectId?: number;

  @ManyToOne(() => Subject, (subject) => subject.learningActivities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subjectId' })
  subject?: Subject;

  @OneToMany(() => Milestone, (milestone) => milestone.learningActivity)
  milestones!: Milestone[];

  @Column({ type: 'int', nullable: true })
  schoolId?: number;

  @ManyToOne(() => School, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'schoolId' })
  school?: School;

  @Column({ type: "int", nullable: true })
  creatorId?: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "creatorId" })
  creator?: User;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  updatedAt!: Date;
}
