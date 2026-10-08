import { pgTable, serial, integer, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";
import { missionsTable } from "./missions";

export type RemainingPaymentRow = {
  missionId: number;
  missionNumber: string;
  employeeId: number;
  matricule: string | null;
  nni: string | null;
  firstName: string;
  lastName: string;
  amount: number;
  totalFee: number;
  month: number;
  year: number;
};

// Immutable snapshots allow safe re-downloads even if employee records change.
export const remainingPaymentExportsTable = pgTable("remaining_payment_exports", {
  id: serial("id").primaryKey(),
  requestId: uuid("request_id").notNull().unique(),
  createdByUserId: integer("created_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  rows: jsonb("rows").$type<RemainingPaymentRow[]>().notNull(),
});

// The primary key enforces one settlement per mission, independently of the UI.
export const remainingPaymentMissionsTable = pgTable("remaining_payment_missions", {
  missionId: integer("mission_id").primaryKey().references(() => missionsTable.id, { onDelete: "restrict" }),
  exportId: integer("export_id").notNull().references(() => remainingPaymentExportsTable.id, { onDelete: "restrict" }),
});
