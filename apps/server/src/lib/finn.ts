import {
  expenseCategories,
  expense,
  insight,
  report,
  type ExpenseCategory,
  type InsightSummary,
  type InsightMetadata,
  type ReportPeriodType,
  and,
  desc,
  eq,
} from "@finn/db";

import { db } from "@finn/db";
import { z } from "zod";
import {
  answerMoneyQuestion,
  buildAnalyticsSnapshot,
  buildReportMetadataFromSnapshot,
} from "@/lib/analytics";
import { askFinnWithGemini } from "@/lib/gemini";

type ExpenseRow = typeof expense.$inferSelect;
type AnalyticsPeriod = "daily" | "weekly" | "monthly";

const llmAskResponseSchema = z.object({
  answer: z.string().trim().min(1),
  bullets: z.array(z.string().trim().min(1)).min(1).max(3),
  suggestions: z.array(z.string().trim().min(1)).min(1).max(3),
  supportingSignalTitles: z.array(z.string().trim().min(1)).max(5).default([]),
});

const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatInr(amountMinor: number) {
  return INR_FORMATTER.format(amountMinor / 100);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const next = startOfDay(date);
  next.setDate(next.getDate() + diff);
  return next;
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

function endOfWeek(date: Date) {
  const start = startOfWeek(date);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function subtractDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - amount);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function sumExpenses(expensesToSum: ExpenseRow[]) {
  return expensesToSum.reduce((total, item) => total + item.amountMinor, 0);
}

function previousPeriodStart(date: Date, periodType: "weekly" | "monthly") {
  return periodType === "weekly"
    ? subtractDays(date, 7)
    : new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

function previousPeriodEnd(date: Date, periodType: "weekly" | "monthly") {
  return periodType === "weekly"
    ? date
    : new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatPeriodTitle(periodType: ReportPeriodType, periodStart: Date) {
  return periodType === "weekly"
    ? `Week of ${periodStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
    : periodStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function buildReportSummary(
  periodType: ReportPeriodType,
  expensesForPeriod: ExpenseRow[],
  personaLabel?: string | null,
) {
  if (expensesForPeriod.length === 0) {
    return periodType === "weekly"
      ? "No spend logged this week yet. Finn will start spotting patterns once activity comes in."
      : "No spend logged this month yet. Finn will summarize the month as soon as transactions arrive.";
  }

  const total = sumExpenses(expensesForPeriod);
  const topMerchant = [...expensesForPeriod]
    .sort((a, b) => b.amountMinor - a.amountMinor)[0]
    ?.merchantName;

  const personaCopy = personaLabel ? ` You are currently reading as ${personaLabel}.` : "";

  return periodType === "weekly"
    ? `You logged ${formatInr(total)} this week across ${expensesForPeriod.length} payments. ${topMerchant ? `${topMerchant} was the biggest single merchant.` : "Finn is tracking where the money is moving."}${personaCopy}`
    : `You logged ${formatInr(total)} this month across ${expensesForPeriod.length} payments. ${topMerchant ? `${topMerchant} stood out most in this cycle.` : "Finn is building a clearer picture of your monthly pattern."}${personaCopy}`;
}

function createInsightRecord(args: {
  userId: string;
  type: typeof insight.$inferInsert.type;
  severity: typeof insight.$inferInsert.severity;
  title: string;
  body: string;
  metadata?: InsightMetadata;
  createdAt?: Date;
}) {
  return {
    id: crypto.randomUUID(),
    userId: args.userId,
    type: args.type,
    severity: args.severity,
    status: "active" as const,
    title: args.title,
    body: args.body,
    metadata: args.metadata ?? {},
    createdAt: args.createdAt ?? new Date(),
  };
}

function buildInsights(userId: string, expensesForUser: ExpenseRow[]) {
  if (expensesForUser.length === 0) {
    return [];
  }

  const insightsToInsert: Array<typeof insight.$inferInsert> = [];
  const sortedExpenses = [...expensesForUser].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const now = new Date();
  const currentWindowStart = startOfDay(subtractDays(now, 89));
  const previousWindowStart = startOfDay(subtractDays(now, 179));
  const currentWindow = sortedExpenses.filter((item) => item.occurredAt >= currentWindowStart);
  const previousWindow = sortedExpenses.filter(
    (item) => item.occurredAt >= previousWindowStart && item.occurredAt < currentWindowStart,
  );
  const snapshot = buildAnalyticsSnapshot({
    expenses: currentWindow,
    previousExpenses: previousWindow,
    now,
  });

  for (const signal of snapshot.behavioralSignals) {
    const type =
      signal.key === "weekly-spike"
        ? "spike"
        : signal.key === "recurring"
          ? "recurring"
          : signal.key === "projection"
            ? "projection"
            : signal.key === "silence"
              ? "silence"
              : signal.key === "guilt-index"
                ? "guilt-index"
                : signal.key === "category-concentration"
                  ? "category-trend"
                  : signal.key === "month-end-crunch"
                    ? "streak"
                    : signal.key === "persona"
                      ? "behavior-pattern"
                      : "behavior-pattern";

    const metadata: InsightMetadata = {
      summary: signal.summary,
      personaLabel: snapshot.persona?.label,
    };

    const projection = snapshot.projections[0];
    if (type === "projection" && projection) {
      metadata.category = projection.category;
      metadata.projectedAmountMinor = projection.projectedAmountMinor;
      metadata.baselineAmountMinor = projection.baselineAmountMinor;
    }

    const recurringCharge = snapshot.recurringCharges[0];
    if (type === "recurring" && recurringCharge) {
      metadata.merchantName = recurringCharge.merchantName;
      metadata.amountMinor = recurringCharge.amountMinor;
      metadata.cadenceDays = recurringCharge.cadenceDays;
      metadata.category = recurringCharge.category;
    }

    const silence = snapshot.unusualSilence[0];
    if (type === "silence" && silence) {
      metadata.category = silence.category;
      metadata.expectedGapDays = silence.expectedGapDays;
      metadata.actualGapDays = silence.actualGapDays;
    }

    insightsToInsert.push(
      createInsightRecord({
        userId,
        type,
        severity: signal.severity,
        title: signal.title,
        body: signal.summary,
        metadata,
      }),
    );
  }

  const averageAmount = Math.round(sumExpenses(sortedExpenses) / sortedExpenses.length);
  const largeExpense = sortedExpenses.find((item) => item.amountMinor >= averageAmount * 2.5);
  if (largeExpense) {
    insightsToInsert.push(
      createInsightRecord({
        userId,
        type: "large-expense",
        severity: "high",
        title: "One payment landed well above your norm",
        body: `${largeExpense.merchantName} at ${formatInr(largeExpense.amountMinor)} stands out against your typical payment size.`,
        metadata: {
          amountMinor: largeExpense.amountMinor,
          merchantName: largeExpense.merchantName,
          category: largeExpense.category,
        },
        createdAt: largeExpense.occurredAt,
      }),
    );
  }

  const uniqueDays = [...new Set(sortedExpenses.map((item) => startOfDay(item.occurredAt).toISOString()))]
    .map((day) => new Date(day))
    .sort((a, b) => a.getTime() - b.getTime());

  let streak = 1;
  let longestStreak = 1;
  for (let index = 1; index < uniqueDays.length; index += 1) {
    const currentDay = uniqueDays[index];
    const previousDay = uniqueDays[index - 1];

    if (!currentDay || !previousDay) {
      continue;
    }

    if (isSameDay(currentDay, subtractDays(previousDay, -1))) {
      streak += 1;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      streak = 1;
    }
  }

  if (longestStreak >= 3) {
    insightsToInsert.push(
      createInsightRecord({
        userId,
        type: "streak",
        severity: "low",
        title: "A daily spend streak is forming",
        body: `You have logged payments on ${longestStreak} consecutive days. Finn will keep an eye on whether this becomes a habit.`,
        metadata: {
          count: longestStreak,
        },
      }),
    );
  }

  return insightsToInsert
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .slice(0, 6);
}

async function rebuildReports(userId: string, expensesForUser: ExpenseRow[]) {
  const periods = new Map<
    string,
    {
      periodType: "weekly" | "monthly";
      periodStart: Date;
      periodEnd: Date;
      expensesForPeriod: ExpenseRow[];
    }
  >();

  for (const item of expensesForUser) {
    const weeklyStart = startOfWeek(item.occurredAt);
    const weeklyKey = `weekly:${weeklyStart.toISOString()}`;
    const weekly = periods.get(weeklyKey) ?? {
      periodType: "weekly" as const,
      periodStart: weeklyStart,
      periodEnd: endOfWeek(item.occurredAt),
      expensesForPeriod: [],
    };
    weekly.expensesForPeriod.push(item);
    periods.set(weeklyKey, weekly);

    const monthlyStart = startOfMonth(item.occurredAt);
    const monthlyKey = `monthly:${monthlyStart.toISOString()}`;
    const monthly = periods.get(monthlyKey) ?? {
      periodType: "monthly" as const,
      periodStart: monthlyStart,
      periodEnd: endOfMonth(item.occurredAt),
      expensesForPeriod: [],
    };
    monthly.expensesForPeriod.push(item);
    periods.set(monthlyKey, monthly);
  }

  const reportsToInsert: Array<typeof report.$inferInsert> = [];

  for (const period of periods.values()) {
    const comparisonStart = previousPeriodStart(period.periodStart, period.periodType);
    const comparisonEnd = previousPeriodEnd(period.periodStart, period.periodType);
    const previousExpenses = expensesForUser.filter(
      (item) => item.occurredAt >= comparisonStart && item.occurredAt < comparisonEnd,
    );
    const snapshot = buildAnalyticsSnapshot({
      expenses: period.expensesForPeriod,
      previousExpenses,
      now: period.periodEnd,
    });

    reportsToInsert.push({
      id: crypto.randomUUID(),
      userId,
      periodType: period.periodType,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      title: formatPeriodTitle(period.periodType, period.periodStart),
      summary: buildReportSummary(period.periodType, period.expensesForPeriod, snapshot.persona?.label ?? null),
      metadata: buildReportMetadataFromSnapshot(snapshot),
      createdAt: period.periodEnd,
    });
  }

  reportsToInsert.sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime());

  await db.delete(report).where(eq(report.userId, userId));
  if (reportsToInsert.length > 0) {
    await db.insert(report).values(reportsToInsert);
  }
}

export async function syncAnalyticsForUser(userId: string) {
  const expensesForUser = await db
    .select()
    .from(expense)
    .where(eq(expense.userId, userId))
    .orderBy(desc(expense.occurredAt));

  await db.delete(insight).where(eq(insight.userId, userId));

  const insightsToInsert = buildInsights(userId, expensesForUser);
  if (insightsToInsert.length > 0) {
    await db.insert(insight).values(insightsToInsert);
  }

  await rebuildReports(userId, expensesForUser);
}

export async function getExpenseFeed(userId: string) {
  await syncAnalyticsForUser(userId);

  const [insightsForUser, recentExpenses, expensesForUser] = await Promise.all([
    db.select().from(insight).where(eq(insight.userId, userId)).orderBy(desc(insight.createdAt)).limit(8),
    db.select().from(expense).where(eq(expense.userId, userId)).orderBy(desc(expense.occurredAt)).limit(8),
    db.select().from(expense).where(eq(expense.userId, userId)).orderBy(desc(expense.occurredAt)).limit(90),
  ]);

  const now = new Date();
  const currentWindowStart = startOfDay(subtractDays(now, 89));
  const previousWindowStart = startOfDay(subtractDays(now, 179));
  const previousWindowEnd = currentWindowStart;
  const feedSnapshot = buildAnalyticsSnapshot({
    expenses: expensesForUser.filter((item) => item.occurredAt >= currentWindowStart),
    previousExpenses: expensesForUser.filter(
      (item) => item.occurredAt >= previousWindowStart && item.occurredAt < previousWindowEnd,
    ),
    now,
  });

  return {
    insights: insightsForUser,
    recentExpenses,
    snapshot: feedSnapshot,
    suggestedQuestions: [
      "Why did I spend more last week?",
      "What is my biggest financial blind spot?",
      "Do I have any recurring charges?",
    ],
  };
}

export async function listExpenses(userId: string) {
  return db
    .select()
    .from(expense)
    .where(eq(expense.userId, userId))
    .orderBy(desc(expense.occurredAt), desc(expense.createdAt))
    .limit(32);
}

export async function createExpenseForUser(input: {
  userId: string;
  amountMinor: number;
  merchantName: string;
  category: ExpenseCategory;
  occurredAt: Date;
  note?: string;
}) {
  const [createdExpense] = await db
    .insert(expense)
    .values({
      id: crypto.randomUUID(),
      userId: input.userId,
      amountMinor: input.amountMinor,
      currency: "INR",
      merchantName: input.merchantName,
      category: input.category,
      occurredAt: input.occurredAt,
      note: input.note,
    })
    .returning();

  await syncAnalyticsForUser(input.userId);

  return createdExpense;
}

export async function deleteExpenseForUser(userId: string, expenseId: string) {
  const [deletedExpense] = await db
    .delete(expense)
    .where(and(eq(expense.id, expenseId), eq(expense.userId, userId)))
    .returning();

  if (deletedExpense) {
    await syncAnalyticsForUser(userId);
  }

  return deletedExpense;
}

function buildAnalyticsLabel(period: AnalyticsPeriod, periodStart: Date) {
  if (period === "daily") {
    return periodStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }

  return period === "weekly"
    ? periodStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : periodStart.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function buildAnalyticsRangeLabel(period: AnalyticsPeriod, periodStart: Date, periodEnd: Date) {
  if (period === "daily") {
    return periodStart.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  if (period === "weekly") {
    const endDate = new Date(periodEnd.getTime() - 1);
    return `${periodStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - ${endDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
  }

  return periodStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function buildAnalyticsSummary(expensesForPeriod: ExpenseRow[]) {
  const totalSpend = sumExpenses(expensesForPeriod);
  const transactionCount = expensesForPeriod.length;
  const periodStart = expensesForPeriod.reduce<Date | null>(
    (earliest, entry) =>
      earliest && earliest.getTime() < entry.occurredAt.getTime() ? earliest : entry.occurredAt,
    null,
  );
  const periodEnd = expensesForPeriod.reduce<Date | null>(
    (latest, entry) =>
      latest && latest.getTime() > entry.occurredAt.getTime() ? latest : entry.occurredAt,
    null,
  );
  const spanDays =
    periodStart && periodEnd
      ? Math.max(1, Math.ceil((endOfDay(periodEnd).getTime() - startOfDay(periodStart).getTime()) / 86_400_000))
      : 1;

  const categoryTotals = expenseCategories.map((category) => ({
    category,
    amountMinor: sumExpenses(expensesForPeriod.filter((entry) => entry.category === category)),
    transactionCount: expensesForPeriod.filter((entry) => entry.category === category).length,
  }));

  const topCategory = categoryTotals
    .filter((entry) => entry.amountMinor > 0)
    .sort((a, b) => b.amountMinor - a.amountMinor)[0] ?? null;

  const merchantMap = new Map<string, { amountMinor: number; count: number }>();
  for (const entry of expensesForPeriod) {
    const current = merchantMap.get(entry.merchantName) ?? { amountMinor: 0, count: 0 };
    merchantMap.set(entry.merchantName, {
      amountMinor: current.amountMinor + entry.amountMinor,
      count: current.count + 1,
    });
  }

  const topMerchant =
    [...merchantMap.entries()]
      .sort((a, b) => b[1].amountMinor - a[1].amountMinor)
      .map(([merchantName, value]) => ({
        merchantName,
        amountMinor: value.amountMinor,
        count: value.count,
      }))[0] ?? null;

  const categoryBreakdown = categoryTotals
    .filter((entry) => entry.amountMinor > 0)
    .sort((a, b) => b.amountMinor - a.amountMinor)
    .slice(0, 4)
    .map((entry) => ({
      category: entry.category,
      amountMinor: entry.amountMinor,
      percentage: totalSpend > 0 ? Number(((entry.amountMinor / totalSpend) * 100).toFixed(1)) : 0,
    }));

  const otherAmountMinor =
    totalSpend - categoryBreakdown.reduce((sum, entry) => sum + entry.amountMinor, 0);

  if (otherAmountMinor > 0) {
    categoryBreakdown.push({
      category: "other",
      amountMinor: otherAmountMinor,
      percentage: totalSpend > 0 ? Number(((otherAmountMinor / totalSpend) * 100).toFixed(1)) : 0,
    });
  }

  return {
    totalSpend,
    transactionCount,
    averagePayment: transactionCount > 0 ? Math.round(totalSpend / transactionCount) : 0,
    dailyAverage: Math.round(totalSpend / spanDays),
    topCategory: topCategory
      ? {
          category: topCategory.category,
          amountMinor: topCategory.amountMinor,
        }
      : null,
    topMerchant,
    categoryTotals: Object.fromEntries(
      categoryTotals.map((entry) => [
        entry.category,
        {
          amountMinor: entry.amountMinor,
          transactionCount: entry.transactionCount,
        },
      ]),
    ) as Record<ExpenseCategory, { amountMinor: number; transactionCount: number }>,
    categoryBreakdown,
  };
}

function getPeriodBounds(period: AnalyticsPeriod, date: Date) {
  if (period === "daily") {
    return {
      periodStart: startOfDay(date),
      periodEnd: endOfDay(date),
    };
  }

  if (period === "weekly") {
    return {
      periodStart: startOfWeek(date),
      periodEnd: endOfWeek(date),
    };
  }

  return {
    periodStart: startOfMonth(date),
    periodEnd: endOfMonth(date),
  };
}

function buildAnalyticsOverview(expensesForUser: ExpenseRow[]) {
  const totalSpend = sumExpenses(expensesForUser);
  const transactionCount = expensesForUser.length;
  const sorted = [...expensesForUser].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const activeDays = new Set(
    expensesForUser.map((entry) => startOfDay(entry.occurredAt).toISOString()),
  ).size;
  const activeMonths = new Set(
    expensesForUser.map(
      (entry) => `${entry.occurredAt.getFullYear()}-${String(entry.occurredAt.getMonth() + 1).padStart(2, "0")}`,
    ),
  ).size;

  return {
    totalSpend,
    transactionCount,
    averagePayment: transactionCount > 0 ? Math.round(totalSpend / transactionCount) : 0,
    activeDays,
    activeMonths,
    firstExpenseAt: sorted[0]?.occurredAt ?? null,
    lastExpenseAt: sorted[sorted.length - 1]?.occurredAt ?? null,
  };
}

function buildCategorySummaries(expensesForUser: ExpenseRow[]) {
  const totalSpend = Math.max(sumExpenses(expensesForUser), 1);

  return expenseCategories
    .map((category) => {
      const entries = expensesForUser.filter((entry) => entry.category === category);
      const amountMinor = sumExpenses(entries);
      const latest = [...entries].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0];

      return {
        category,
        totalSpend: amountMinor,
        transactionCount: entries.length,
        averagePayment: entries.length > 0 ? Math.round(amountMinor / entries.length) : 0,
        share: amountMinor > 0 ? Number(((amountMinor / totalSpend) * 100).toFixed(1)) : 0,
        lastExpenseAt: latest?.occurredAt ?? null,
      };
    })
    .filter((entry) => entry.transactionCount > 0)
    .sort((a, b) => b.totalSpend - a.totalSpend);
}

function buildTopMerchantSummaries(expensesForUser: ExpenseRow[]) {
  const merchantMap = new Map<string, { amountMinor: number; count: number; lastOccurredAt: Date }>();

  for (const entry of expensesForUser) {
    const current = merchantMap.get(entry.merchantName);
    merchantMap.set(entry.merchantName, {
      amountMinor: (current?.amountMinor ?? 0) + entry.amountMinor,
      count: (current?.count ?? 0) + 1,
      lastOccurredAt:
        current && current.lastOccurredAt.getTime() > entry.occurredAt.getTime()
          ? current.lastOccurredAt
          : entry.occurredAt,
    });
  }

  return [...merchantMap.entries()]
    .sort((a, b) => b[1].amountMinor - a[1].amountMinor)
    .slice(0, 6)
    .map(([merchantName, value]) => ({
      merchantName,
      amountMinor: value.amountMinor,
      count: value.count,
      lastOccurredAt: value.lastOccurredAt,
    }));
}

async function buildAskMoneyContext(userId: string) {
  const expensesForUser = await db
    .select()
    .from(expense)
    .where(eq(expense.userId, userId))
    .orderBy(desc(expense.occurredAt));

  const now = new Date();
  const currentWindowStart = startOfDay(subtractDays(now, 6));
  const previousWindowStart = startOfDay(subtractDays(now, 13));
  const snapshotWindowStart = startOfDay(subtractDays(now, 89));
  const previousSnapshotWindowStart = startOfDay(subtractDays(now, 179));

  const currentExpenses = expensesForUser.filter((item) => item.occurredAt >= currentWindowStart);
  const previousExpenses = expensesForUser.filter(
    (item) => item.occurredAt >= previousWindowStart && item.occurredAt < currentWindowStart,
  );

  const snapshot = buildAnalyticsSnapshot({
    expenses: expensesForUser.filter((item) => item.occurredAt >= snapshotWindowStart),
    previousExpenses: expensesForUser.filter(
      (item) =>
        item.occurredAt >= previousSnapshotWindowStart && item.occurredAt < snapshotWindowStart,
    ),
    now,
  });

  return {
    currentExpenses,
    previousExpenses,
    snapshot,
  };
}

export { buildAskMoneyContext };

export function parseAskMoneyLlmResponse(llmContent: string, behavioralSignals: InsightSummary[]) {
  const parsed = llmAskResponseSchema.parse(JSON.parse(llmContent));
  const supportingSignals = behavioralSignals.filter((entry) =>
    parsed.supportingSignalTitles.includes(entry.title),
  );

  return {
    answer: parsed.answer,
    bullets: parsed.bullets,
    suggestions: parsed.suggestions,
    supportingSignals,
  };
}

export async function askMoneyQuestion(
  userId: string,
  question: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
) {
  const { currentExpenses, previousExpenses, snapshot } = await buildAskMoneyContext(userId);

  try {
    const llmContent = await askFinnWithGemini({
      question,
      currentExpenses,
      previousExpenses,
      snapshot,
      history,
    });

    if (llmContent) {
      return parseAskMoneyLlmResponse(llmContent, snapshot.behavioralSignals);
    }
  } catch (error) {
    console.error("Gemini Ask Finn fallback", error);
  }

  const fallback = answerMoneyQuestion({
    question,
    currentExpenses,
    previousExpenses,
    snapshot,
  });

  return {
    ...fallback,
    bullets: fallback.supportingSignals.slice(0, 3).map((entry) => entry.summary),
  };
}

export async function getAnalytics(userId: string, period: AnalyticsPeriod) {
  const expensesForUser = await db
    .select()
    .from(expense)
    .where(eq(expense.userId, userId))
    .orderBy(desc(expense.occurredAt));

  const buckets = new Map<
    string,
    {
      periodStart: Date;
      periodEnd: Date;
      expensesForPeriod: ExpenseRow[];
    }
  >();

  for (const entry of expensesForUser) {
    const { periodStart, periodEnd } = getPeriodBounds(period, entry.occurredAt);
    const bucketKey = periodStart.toISOString();
    const bucket = buckets.get(bucketKey) ?? {
      periodStart,
      periodEnd,
      expensesForPeriod: [],
    };
    bucket.expensesForPeriod.push(entry);
    buckets.set(bucketKey, bucket);
  }

  const periods = [...buckets.values()]
    .sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime())
    .reverse()
    .map((bucket) => {
      const summary = buildAnalyticsSummary(bucket.expensesForPeriod);

      return {
        id: `${period}:${bucket.periodStart.toISOString()}`,
        label: buildAnalyticsLabel(period, bucket.periodStart),
        rangeLabel: buildAnalyticsRangeLabel(period, bucket.periodStart, bucket.periodEnd),
        periodStart: bucket.periodStart,
        periodEnd: bucket.periodEnd,
        ...summary,
      };
    });

  return {
    period,
    selectedPeriodId: periods[periods.length - 1]?.id ?? null,
    overview: buildAnalyticsOverview(expensesForUser),
    periods,
    categories: buildCategorySummaries(expensesForUser),
    topMerchants: buildTopMerchantSummaries(expensesForUser),
  };
}
