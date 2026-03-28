import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";
import {
  type AnalyticsMemoryPayload,
  type AnalyticsPeriodBucket,
  type AnalyticsPeriodType,
  expenseCategories,
  type BehavioralPersona,
  type ExpenseCategory,
  type FinancialMemoryFact,
  type InsightSeverity,
  type InsightSummary,
  type ReportMetadata,
} from "@/lib/finn-types";
import { env } from "@finn/env/native";

type ExpenseDto = {
  id: string;
  amountMinor: number;
  currency: string;
  merchantName: string;
  category: ExpenseCategory;
  occurredAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export { expenseCategories };

type InsightDto = {
  id: string;
  type: string;
  severity: InsightSeverity;
  status: string;
  title: string;
  body: string;
  createdAt: string;
};

type MemoryFactDto = FinancialMemoryFact;

type SnapshotDto = {
  metrics: ReportMetadata["metrics"];
  topCategories: ReportMetadata["topCategories"];
  topMerchants: ReportMetadata["topMerchants"];
  transactionCount: number;
  persona: BehavioralPersona | null;
  behavioralSignals: InsightSummary[];
  dayOfWeekSpend: ReportMetadata["dayOfWeekSpend"];
  projections: ReportMetadata["projections"];
  recurringCharges: ReportMetadata["recurringCharges"];
  unusualSilence: ReportMetadata["unusualSilence"];
  emotionalSpendingFingerprint?: string;
  endOfMonthCrunch?: string;
  guiltIndex?: ReportMetadata["guiltIndex"];
};

async function apiRequest<T>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  const cookie = authClient.getCookie();
  if (cookie) {
    headers.set("cookie", cookie);
  }

  const response = await fetch(`${env.EXPO_PUBLIC_SERVER_URL}/api${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Request failed");
  }

  return (await response.json()) as T;
}

export async function createExpense(input: {
  amountMinor: number;
  merchantName: string;
  category: ExpenseCategory;
  occurredAt: string;
  note?: string;
}) {
  return apiRequest<{ expense: ExpenseDto }>("/expenses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function useFeedQuery() {
  return useQuery({
    queryKey: ["feed"],
    queryFn: () =>
      apiRequest<{
        insights: InsightDto[];
        memoryFacts: MemoryFactDto[];
        recentExpenses: ExpenseDto[];
        snapshot: SnapshotDto;
        suggestedQuestions: string[];
      }>("/feed"),
  });
}

export function useExpensesQuery() {
  return useQuery({
    queryKey: ["expenses"],
    queryFn: () => apiRequest<{ expenses: ExpenseDto[] }>("/expenses"),
  });
}

export function useAnalyticsQuery(period: AnalyticsPeriodType) {
  return useQuery({
    queryKey: ["analytics", period],
    queryFn: () =>
      apiRequest<{
        period: AnalyticsPeriodType;
        selectedPeriodId: string | null;
        periods: AnalyticsPeriodBucket[];
        memory: AnalyticsMemoryPayload;
      }>(`/analytics?period=${period}`),
  });
}

export async function askFinn(question: string) {
  return apiRequest<{
    answer: string;
    bullets: string[];
    suggestions: string[];
    supportingSignals: InsightSummary[];
  }>("/ask", {
    method: "POST",
    body: JSON.stringify({ question, history: [] }),
  });
}

export async function chatWithFinn(input: {
  question: string;
  history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}) {
  return apiRequest<{
    answer: string;
    bullets: string[];
    suggestions: string[];
    supportingSignals: InsightSummary[];
  }>("/ask", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
