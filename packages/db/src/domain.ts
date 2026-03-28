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

export const insightStatuses = ["active", "resolved", "snoozed", "notified"] as const;

export const reportPeriodTypes = ["weekly", "monthly"] as const;
export const notificationChannels = ["push", "briefing", "report"] as const;
export const notificationStatuses = ["pending", "sent", "failed", "skipped"] as const;
export const memoryNodeTypes = [
  "merchant",
  "category",
  "time-bucket",
  "day-bucket",
  "salary-window",
  "pattern",
] as const;
export const memoryEdgeRelations = [
  "categorized-as",
  "peaks-in",
  "spikes-on",
  "clusters-in",
  "reinforces",
] as const;
export const memoryFactKinds = [
  "recurring-merchant",
  "time-of-day",
  "weekend-pattern",
  "salary-cycle",
  "spend-shift",
  "merchant-category-mismatch",
] as const;
export const memoryFactStatuses = ["active", "archived"] as const;

export type ExpenseCategory = (typeof expenseCategories)[number];
export type InsightType = (typeof insightTypes)[number];
export type InsightSeverity = (typeof insightSeverities)[number];
export type InsightStatus = (typeof insightStatuses)[number];
export type ReportPeriodType = (typeof reportPeriodTypes)[number];
export type NotificationChannel = (typeof notificationChannels)[number];
export type NotificationStatus = (typeof notificationStatuses)[number];
export type MemoryNodeType = (typeof memoryNodeTypes)[number];
export type MemoryEdgeRelation = (typeof memoryEdgeRelations)[number];
export type MemoryFactKind = (typeof memoryFactKinds)[number];
export type MemoryFactStatus = (typeof memoryFactStatuses)[number];

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
  key?: string;
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
  streakDays?: number;
  lastObservedAt?: string;
  currentAmountMinor?: number;
  previousAmountMinor?: number;
  fingerprint?: string;
  heuristic?: string;
  narrative?: string;
};

export type NotificationMetadata = {
  insightId?: string;
  insightKey?: string;
  reportId?: string;
  reportPeriodType?: ReportPeriodType;
  provider?: string;
  error?: string;
  payload?: Record<string, unknown>;
};

export type MemoryNodeMetadata = {
  normalizedMerchantName?: string;
  rawMerchantNames?: string[];
  category?: ExpenseCategory;
  dayBucket?: "weekday" | "weekend";
  timeBucket?: "early-morning" | "morning" | "afternoon" | "evening" | "late-night";
  salaryWindow?: "early-month" | "mid-month" | "month-end";
  averageAmountMinor?: number;
  totalAmountMinor?: number;
  transactionCount?: number;
  sampleSize?: number;
};

export type MemoryEdgeMetadata = {
  supportCount?: number;
  totalAmountMinor?: number;
  averageAmountMinor?: number;
  percentage?: number;
  category?: ExpenseCategory;
  timeBucket?: MemoryNodeMetadata["timeBucket"];
  dayBucket?: MemoryNodeMetadata["dayBucket"];
  salaryWindow?: MemoryNodeMetadata["salaryWindow"];
};

export type MemoryFactEvidence = {
  expenseIds?: string[];
  relatedNodeKeys?: string[];
  merchantName?: string;
  category?: ExpenseCategory;
  timeBucket?: MemoryNodeMetadata["timeBucket"];
  dayBucket?: MemoryNodeMetadata["dayBucket"];
  salaryWindow?: MemoryNodeMetadata["salaryWindow"];
  sampleSize?: number;
  baselineAmountMinor?: number;
  currentAmountMinor?: number;
  averageGapDays?: number;
  dominantCategory?: ExpenseCategory;
  mismatchCount?: number;
  supportingSignals?: string[];
};

export type MemoryObservationMetadata = {
  normalizedMerchantName?: string;
  timeBucket?: MemoryNodeMetadata["timeBucket"];
  dayBucket?: MemoryNodeMetadata["dayBucket"];
  salaryWindow?: MemoryNodeMetadata["salaryWindow"];
  dominantCategory?: ExpenseCategory;
  categoryConsistent?: boolean;
};
