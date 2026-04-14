import { pgTable, text, serial, timestamp, integer, boolean, pgEnum, date, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const missionStatusEnum = pgEnum("mission_status", [
  "draft",
  "pending_director",
  "pending_central_director",
  "pending_technical_control",
  "pending_dga",
  "pending_dmg",
  "pending_cad",
  "pending_financial_control",
  "pending_drh",
  "approved",
  "rejected",
]);

export const missionsTable = pgTable("missions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  needsExpression: text("needs_expression").notNull(),
  actionPlan: text("action_plan").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  destination: text("destination").notNull(),
  requiresFuel: boolean("requires_fuel").notNull().default(false),
  requiresVehicle: boolean("requires_vehicle").notNull().default(false),
  vehicleCount: integer("vehicle_count").notNull().default(0),
  vehicleDetails: text("vehicle_details"),
  status: missionStatusEnum("status").notNull().default("draft"),
  currentValidationRole: text("current_validation_role"),
  createdByUserId: integer("created_by_user_id").notNull(),
  departmentId: integer("department_id"),
  orderNumber: text("order_number"),
  orderGeneratedAt: timestamp("order_generated_at", { withTimezone: true }),
  orderGeneratedByUserId: integer("order_generated_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const missionEmployeesTable = pgTable("mission_employees", {
  id: serial("id").primaryKey(),
  missionId: integer("mission_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const missionValidationsTable = pgTable("mission_validations", {
  id: serial("id").primaryKey(),
  missionId: integer("mission_id").notNull(),
  validatorUserId: integer("validator_user_id").notNull(),
  validatorRole: text("validator_role").notNull(),
  action: text("action").notNull(),
  comment: text("comment"),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMissionSchema = createInsertSchema(missionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMission = z.infer<typeof insertMissionSchema>;
export type Mission = typeof missionsTable.$inferSelect;
export type MissionEmployee = typeof missionEmployeesTable.$inferSelect;
export type MissionValidation = typeof missionValidationsTable.$inferSelect;
