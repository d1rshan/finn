import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import {
  expenseCategories,
  insightSeverities,
  insightStatuses,
  insightTypes,
  reportPeriodTypes,
  type InsightMetadata,
  type ReportMetadata,
} from "../domain";
import { user } from "./auth";

export const expenseCategoryEnum = pgEnum("expense_category", expenseCategories);
export const insightTypeEnum = pgEnum("insight_type", insightTypes);
export const insightSeverityEnum = pgEnum("insight_severity", insightSeverities);
export const insightStatusEnum = pgEnum("insight_status", insightStatuses);
export const reportPeriodTypeEnum = pgEnum("report_period_type", reportPeriodTypes);

export const expense = pgTable(
  "expense",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("INR"),
    merchantName: text("merchant_name").notNull(),
    category: expenseCategoryEnum("category").notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("expense_user_occurred_at_idx").on(table.userId, table.occurredAt)],
);

export const insight = pgTable(
  "insight",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: insightTypeEnum("type").notNull(),
    severity: insightSeverityEnum("severity").notNull().default("low"),
    status: insightStatusEnum("status").notNull().default("active"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    metadata: jsonb("metadata").$type<InsightMetadata>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("insight_user_created_at_idx").on(table.userId, table.createdAt)],
);

export const report = pgTable(
  "report",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    periodType: reportPeriodTypeEnum("period_type").notNull(),
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata").$type<ReportMetadata>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("report_user_period_idx").on(table.userId, table.periodType, table.periodStart),
  ],
);
