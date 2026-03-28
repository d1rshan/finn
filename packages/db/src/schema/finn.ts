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
  memoryEdgeRelations,
  memoryFactKinds,
  memoryFactStatuses,
  memoryNodeTypes,
  type MemoryEdgeMetadata,
  type MemoryFactEvidence,
  type MemoryNodeMetadata,
  type MemoryObservationMetadata,
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
export const memoryNodeTypeEnum = pgEnum("memory_node_type", memoryNodeTypes);
export const memoryEdgeRelationEnum = pgEnum("memory_edge_relation", memoryEdgeRelations);
export const memoryFactKindEnum = pgEnum("memory_fact_kind", memoryFactKinds);
export const memoryFactStatusEnum = pgEnum("memory_fact_status", memoryFactStatuses);

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

export const memoryNode = pgTable(
  "memory_node",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: memoryNodeTypeEnum("type").notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    confidence: integer("confidence").notNull().default(100),
    metadata: jsonb("metadata").$type<MemoryNodeMetadata>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("memory_node_user_type_idx").on(table.userId, table.type),
    index("memory_node_user_key_idx").on(table.userId, table.key),
  ],
);

export const memoryEdge = pgTable(
  "memory_edge",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fromNodeId: text("from_node_id")
      .notNull()
      .references(() => memoryNode.id, { onDelete: "cascade" }),
    toNodeId: text("to_node_id")
      .notNull()
      .references(() => memoryNode.id, { onDelete: "cascade" }),
    relation: memoryEdgeRelationEnum("relation").notNull(),
    weight: integer("weight").notNull().default(100),
    metadata: jsonb("metadata").$type<MemoryEdgeMetadata>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("memory_edge_user_relation_idx").on(table.userId, table.relation),
    index("memory_edge_from_to_idx").on(table.fromNodeId, table.toNodeId),
  ],
);

export const memoryFact = pgTable(
  "memory_fact",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: memoryFactKindEnum("kind").notNull(),
    status: memoryFactStatusEnum("status").notNull().default("active"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    confidence: integer("confidence").notNull().default(100),
    evidence: jsonb("evidence").$type<MemoryFactEvidence>().notNull().default({}),
    validFrom: timestamp("valid_from"),
    validTo: timestamp("valid_to"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("memory_fact_user_created_idx").on(table.userId, table.createdAt),
    index("memory_fact_user_kind_idx").on(table.userId, table.kind),
  ],
);

export const memoryObservation = pgTable(
  "memory_observation",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expenseId: text("expense_id")
      .notNull()
      .references(() => expense.id, { onDelete: "cascade" }),
    memoryNodeId: text("memory_node_id").references(() => memoryNode.id, {
      onDelete: "cascade",
    }),
    memoryFactId: text("memory_fact_id").references(() => memoryFact.id, {
      onDelete: "cascade",
    }),
    metadata: jsonb("metadata").$type<MemoryObservationMetadata>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("memory_observation_user_expense_idx").on(table.userId, table.expenseId),
    index("memory_observation_fact_idx").on(table.memoryFactId),
  ],
);
