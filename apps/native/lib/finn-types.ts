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

export type InsightSeverity = "low" | "medium" | "high";

export type InsightSummary = {
  key: string;
  title: string;
  summary: string;
  severity: InsightSeverity;
};

export type BehavioralPersona = {
  label: string;
  summary: string;
};

export type DayOfWeekSpend = {
  day: string;
  amountMinor: number;
  averageAmountMinor: number;
  transactionCount: number;
};

export type SpendProjection = {
  category: ExpenseCategory;
  projectedAmountMinor: number;
  baselineAmountMinor: number;
  deltaMinor: number;
};

export type RecurringCharge = {
  merchantName: string;
  category: ExpenseCategory;
  amountMinor: number;
  cadenceDays: number;
  lastChargedAt: string;
};

export type SilenceSignal = {
  category: ExpenseCategory;
  expectedGapDays: number;
  actualGapDays: number;
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
  persona: BehavioralPersona | null;
  behavioralSignals: InsightSummary[];
  dayOfWeekSpend: DayOfWeekSpend[];
  projections: SpendProjection[];
  recurringCharges: RecurringCharge[];
  unusualSilence: SilenceSignal[];
  emotionalSpendingFingerprint?: string;
  endOfMonthCrunch?: string;
  guiltIndex?: {
    score: number;
    summary: string;
  } | null;
};
