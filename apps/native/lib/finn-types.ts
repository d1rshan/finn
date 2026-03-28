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
export type ReportMetric = {
  label: string;
  value: number;
  change?: number | null;
};

export type InsightSeverity = "low" | "medium" | "high";
export type MemoryFactKind =
  | "recurring-merchant"
  | "time-of-day"
  | "weekend-pattern"
  | "salary-cycle"
  | "spend-shift"
  | "merchant-category-mismatch";
export type MemoryNodeType =
  | "merchant"
  | "category"
  | "time-bucket"
  | "day-bucket"
  | "salary-window"
  | "pattern";

export type InsightSummary = {
  key: string;
  title: string;
  summary: string;
  severity: InsightSeverity;
};

export type FinancialMemoryFact = {
  id: string;
  kind: MemoryFactKind;
  status: "active" | "archived";
  title: string;
  body: string;
  confidence: number;
  createdAt: string;
};

export type FinancialMemoryNode = {
  id: string;
  type: MemoryNodeType;
  key: string;
  label: string;
  confidence: number;
  updatedAt: string;
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

export type AnalyticsPeriodType = "weekly" | "monthly";

export type AnalyticsCategoryBreakdown = {
  category: ExpenseCategory | "other";
  amountMinor: number;
  percentage: number;
};

export type AnalyticsPeriodBucket = {
  id: string;
  label: string;
  rangeLabel: string;
  periodStart: string;
  periodEnd: string;
  totalSpend: number;
  transactionCount: number;
  topCategory: {
    category: ExpenseCategory;
    amountMinor: number;
  } | null;
  topMerchant: {
    merchantName: string;
    amountMinor: number;
    count: number;
  } | null;
  categoryBreakdown: AnalyticsCategoryBreakdown[];
};

export type AnalyticsMemoryPayload = {
  facts: FinancialMemoryFact[];
  nodes: FinancialMemoryNode[];
};
