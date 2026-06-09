import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../../shared/entities/User";

@Entity("system_admin_invitations")
export class SystemAdminInvitation {
  constructor(data?: Partial<SystemAdminInvitation>) {
    if (typeof data === "object" && data !== null) {
      Object.assign(this, data);
    }
  }

  @PrimaryGeneratedColumn("increment")
  id!: number;

  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  firstName?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  lastName?: string | null;

  @Column({ type: "varchar", length: 255, unique: true })
  token!: string;

  @Column({ type: "int" })
  invitedById!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "invitedById" })
  invitedBy?: User;

  @Column({ type: "boolean", default: false })
  hasAccepted!: boolean;

  @Column({ type: "timestamp", nullable: true })
  acceptedAt?: Date | null;

  @Column({ type: "timestamp" })
  expiresAt!: Date;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;
}
