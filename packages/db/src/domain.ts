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
  "behavior-pattern",
  "projection",
  "silence",
  "subscription",
  "guilt-index",
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

export type InsightSummary = {
  key: string;
  title: string;
  summary: string;
  severity: InsightSeverity;
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

export type DayOfWeekSpend = {
  day: string;
  amountMinor: number;
  averageAmountMinor: number;
  transactionCount: number;
};

export type BehavioralPersona = {
  label: string;
  summary: string;
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
  topCategories: ReportTopCategory[];
  topMerchants: ReportTopMerchant[];
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

export type InsightMetadata = {
  amountMinor?: number;
  merchantName?: string;
  category?: ExpenseCategory;
  count?: number;
  percentageChange?: number;
  windowStart?: string;
  windowEnd?: string;
  projectedAmountMinor?: number;
  baselineAmountMinor?: number;
  cadenceDays?: number;
  expectedGapDays?: number;
  actualGapDays?: number;
  summary?: string;
  personaLabel?: string;
};
