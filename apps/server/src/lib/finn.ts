import {
  expense,
  insight,
  report,
  type ExpenseCategory,
  type InsightMetadata,
  and,
  asc,
  desc,
  eq,
  gte,
  lt,
} from "@finn/db";

import { db } from "@finn/db";
import { z } from "zod";
import {
  answerMoneyQuestion,
  buildAnalyticsSnapshot,
  buildReportMetadataFromSnapshot,
} from "@/lib/analytics";
import { askFinnWithGlm } from "@/lib/glm";

type ExpenseRow = typeof expense.$inferSelect;

const llmAskResponseSchema = z.object({
  answer: z.string().trim().min(1),
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

function buildReportSummary(
  periodType: "weekly" | "monthly",
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
      title:
        period.periodType === "weekly"
          ? `Week of ${period.periodStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
          : period.periodStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      summary: buildReportSummary(
        period.periodType,
        period.expensesForPeriod,
        snapshot.persona?.label ?? null,
      ),
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

  const [insightsForUser, recentExpenses, reportsForUser, expensesForUser] = await Promise.all([
    db.select().from(insight).where(eq(insight.userId, userId)).orderBy(desc(insight.createdAt)).limit(8),
    db.select().from(expense).where(eq(expense.userId, userId)).orderBy(desc(expense.occurredAt)).limit(8),
    db
      .select()
      .from(report)
      .where(eq(report.userId, userId))
      .orderBy(desc(report.periodStart))
      .limit(4),
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

  const reportPrompts = reportsForUser.map((entry) => ({
    id: entry.id,
    periodType: entry.periodType,
    title: entry.title,
    summary: entry.summary,
    createdAt: entry.createdAt,
  }));

  return {
    insights: insightsForUser,
    recentExpenses,
    reportPrompts,
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

export async function listReports(userId: string) {
  await syncAnalyticsForUser(userId);

  return db
    .select()
    .from(report)
    .where(eq(report.userId, userId))
    .orderBy(desc(report.periodStart), asc(report.periodType));
}

export async function getReportDetail(userId: string, reportId: string) {
  await syncAnalyticsForUser(userId);

  const [selectedReport] = await db
    .select()
    .from(report)
    .where(and(eq(report.id, reportId), eq(report.userId, userId)));

  return selectedReport ?? null;
}

export async function listExpensesForRange(args: {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  return db
    .select()
    .from(expense)
    .where(
      and(
        eq(expense.userId, args.userId),
        gte(expense.occurredAt, args.periodStart),
        lt(expense.occurredAt, args.periodEnd),
      ),
    )
    .orderBy(desc(expense.occurredAt));
}

export async function askMoneyQuestion(userId: string, question: string) {
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

  try {
    const llmContent = await askFinnWithGlm({
      question,
      currentExpenses,
      previousExpenses,
      snapshot,
    });

    if (llmContent) {
      const parsed = llmAskResponseSchema.parse(JSON.parse(llmContent));
      const supportingSignals = snapshot.behavioralSignals.filter((entry) =>
        parsed.supportingSignalTitles.includes(entry.title),
      );

      return {
        answer: parsed.answer,
        suggestions: parsed.suggestions,
        supportingSignals,
      };
    }
  } catch (error) {
    console.error("GLM Ask Finn fallback", error);
  }

  return answerMoneyQuestion({
    question,
    currentExpenses,
    previousExpenses,
    snapshot,
  });
}
