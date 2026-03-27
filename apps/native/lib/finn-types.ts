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

export type ExpenseCategory = (typeof expenseCategories)[number];
export type ReportPeriodType = "weekly" | "monthly";

export type ReportMetric = {
  label: string;
  value: number;
  change?: number | null;
};

export type ReportMetadata = {
  metrics: ReportMetric[];
  topCategories: Array<{
    category: ExpenseCategory;
    amountMinor: number;
    percentage: number;
  }>;
  topMerchants: Array<{
    merchantName: string;
    amountMinor: number;
    count: number;
  }>;
  transactionCount: number;
};
