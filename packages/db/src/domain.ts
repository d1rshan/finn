export const expenseCategories = [
  "food",
  "commute",
  "groceries",
  "shopping",
  "bills",
  "entertainment",
  "health",
  "travel",
  "transfer",
  "other",
] as const;

export const insightTypes = [
  "spike",
  "recurring",
  "category-trend",
  "large-expense",
  "streak",
] as const;

export const insightSeverities = ["low", "medium", "high"] as const;

export const insightStatuses = ["active", "archived"] as const;

export const reportPeriodTypes = ["weekly", "monthly"] as const;

export type ExpenseCategory = (typeof expenseCategories)[number];
export type InsightType = (typeof insightTypes)[number];
export type InsightSeverity = (typeof insightSeverities)[number];
export type InsightStatus = (typeof insightStatuses)[number];
export type ReportPeriodType = (typeof reportPeriodTypes)[number];

export type ReportMetric = {
  label: string;
  value: number;
  change?: number | null;
};

export type ReportTopCategory = {
  category: ExpenseCategory;
  amountMinor: number;
  percentage: number;
};

export type ReportTopMerchant = {
  merchantName: string;
  amountMinor: number;
  count: number;
};

export type ReportMetadata = {
  metrics: ReportMetric[];
  topCategories: ReportTopCategory[];
  topMerchants: ReportTopMerchant[];
  transactionCount: number;
};

export type InsightMetadata = {
  amountMinor?: number;
  merchantName?: string;
  category?: ExpenseCategory;
  count?: number;
  percentageChange?: number;
  windowStart?: string;
  windowEnd?: string;
};

