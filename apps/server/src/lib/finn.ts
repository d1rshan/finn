import {
  expense,
  expenseCategories,
  insight,
  report,
  type ExpenseCategory,
  type InsightMetadata,
  type ReportMetadata,
  type ReportPeriodType,
  and,
  asc,
  desc,
  eq,
  gte,
  lt,
} from "@finn/db";

import { db } from "@finn/db";

type ExpenseRow = typeof expense.$inferSelect;

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

function titleCase(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildReportSummary(periodType: ReportPeriodType, expensesForPeriod: ExpenseRow[]) {
  if (expensesForPeriod.length === 0) {
    return periodType === "weekly"
      ? "No spend logged this week yet. Finn will start spotting patterns once activity comes in."
      : "No spend logged this month yet. Finn will summarize the month as soon as transactions arrive.";
  }

  const total = sumExpenses(expensesForPeriod);
  const topMerchant = [...expensesForPeriod]
    .sort((a, b) => b.amountMinor - a.amountMinor)[0]
    ?.merchantName;

  return periodType === "weekly"
    ? `You logged ${formatInr(total)} this week across ${expensesForPeriod.length} payments. ${topMerchant ? `${topMerchant} was the biggest single merchant.` : "Finn is tracking where the money is moving."}`
    : `You logged ${formatInr(total)} this month across ${expensesForPeriod.length} payments. ${topMerchant ? `${topMerchant} stood out most in this cycle.` : "Finn is building a clearer picture of your monthly pattern."}`;
}

function buildReportMetadata(
  expensesForPeriod: ExpenseRow[],
  previousPeriodExpenses: ExpenseRow[],
): ReportMetadata {
  const total = sumExpenses(expensesForPeriod);
  const previousTotal = sumExpenses(previousPeriodExpenses);
  const categoryMap = new Map<ExpenseCategory, number>();
  const merchantMap = new Map<string, { amountMinor: number; count: number }>();

  for (const category of expenseCategories) {
    categoryMap.set(category, 0);
  }

  for (const item of expensesForPeriod) {
    categoryMap.set(item.category, (categoryMap.get(item.category) ?? 0) + item.amountMinor);
    const existing = merchantMap.get(item.merchantName) ?? { amountMinor: 0, count: 0 };
    merchantMap.set(item.merchantName, {
      amountMinor: existing.amountMinor + item.amountMinor,
      count: existing.count + 1,
    });
  }

  const change =
    previousTotal > 0 ? Number((((total - previousTotal) / previousTotal) * 100).toFixed(1)) : null;

  const metrics = [
    { label: "Total spend", value: total, change },
    { label: "Transactions", value: expensesForPeriod.length },
    {
      label: "Average payment",
      value: expensesForPeriod.length > 0 ? Math.round(total / expensesForPeriod.length) : 0,
    },
  ];

  const topCategories = [...categoryMap.entries()]
    .filter(([, amountMinor]) => amountMinor > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amountMinor]) => ({
      category,
      amountMinor,
      percentage: total > 0 ? Number(((amountMinor / total) * 100).toFixed(1)) : 0,
    }));

  const topMerchants = [...merchantMap.entries()]
    .sort((a, b) => b[1].amountMinor - a[1].amountMinor)
    .slice(0, 3)
    .map(([merchantName, values]) => ({
      merchantName,
      amountMinor: values.amountMinor,
      count: values.count,
    }));

  return {
    metrics,
    topCategories,
    topMerchants,
    transactionCount: expensesForPeriod.length,
  };
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
  const sortedExpenses = [...expensesForUser].sort(
    (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime(),
  );
  const lastSevenDaysStart = startOfDay(subtractDays(new Date(), 6));
  const previousSevenDaysStart = startOfDay(subtractDays(new Date(), 13));
  const currentWindow = sortedExpenses.filter((item) => item.occurredAt >= lastSevenDaysStart);
  const previousWindow = sortedExpenses.filter(
    (item) => item.occurredAt >= previousSevenDaysStart && item.occurredAt < lastSevenDaysStart,
  );

  const currentTotal = sumExpenses(currentWindow);
  const previousTotal = sumExpenses(previousWindow);

  if (currentTotal > previousTotal * 1.35 && currentTotal - previousTotal >= 100000) {
    const delta = previousTotal === 0 ? null : Number((((currentTotal - previousTotal) / previousTotal) * 100).toFixed(1));
    insightsToInsert.push(
      createInsightRecord({
        userId,
        type: "spike",
        severity: "high",
        title: "Spending picked up sharply this week",
        body: `You are at ${formatInr(currentTotal)} in the last 7 days${delta ? `, up ${delta}% from the previous 7-day window.` : "."}`,
        metadata: {
          amountMinor: currentTotal,
          percentageChange: delta ?? undefined,
          windowStart: lastSevenDaysStart.toISOString(),
          windowEnd: new Date().toISOString(),
        },
      }),
    );
  }

  const merchantGroups = new Map<string, ExpenseRow[]>();
  for (const item of sortedExpenses) {
    const entries = merchantGroups.get(item.merchantName) ?? [];
    entries.push(item);
    merchantGroups.set(item.merchantName, entries);
  }

  const recurringMerchant = [...merchantGroups.entries()]
    .map(([merchantName, entries]) => ({ merchantName, entries }))
    .find(({ entries }) => entries.length >= 3);

  if (recurringMerchant) {
    insightsToInsert.push(
      createInsightRecord({
        userId,
        type: "recurring",
        severity: "medium",
        title: `${recurringMerchant.merchantName} is becoming a pattern`,
        body: `You have paid ${recurringMerchant.merchantName} ${recurringMerchant.entries.length} times. Finn is treating it as a recurring merchant.`,
        metadata: {
          merchantName: recurringMerchant.merchantName,
          count: recurringMerchant.entries.length,
        },
        createdAt: recurringMerchant.entries[0]?.occurredAt,
      }),
    );
  }

  let topCategoryInsight: {
    category: ExpenseCategory;
    currentAmount: number;
    percentageChange: number;
  } | null = null;

  for (const category of expenseCategories) {
    const currentAmount = sumExpenses(currentWindow.filter((item) => item.category === category));
    const previousAmount = sumExpenses(previousWindow.filter((item) => item.category === category));

    if (currentAmount < 50000 || previousAmount <= 0) {
      continue;
    }

    const percentageChange = Number(
      (((currentAmount - previousAmount) / previousAmount) * 100).toFixed(1),
    );

    if (percentageChange < 30) {
      continue;
    }

    if (!topCategoryInsight || percentageChange > topCategoryInsight.percentageChange) {
      topCategoryInsight = { category, currentAmount, percentageChange };
    }
  }

  if (topCategoryInsight) {
    insightsToInsert.push(
      createInsightRecord({
        userId,
        type: "category-trend",
        severity: "medium",
        title: `${titleCase(topCategoryInsight.category)} spend is trending higher`,
        body: `${titleCase(topCategoryInsight.category)} is up ${topCategoryInsight.percentageChange}% this week at ${formatInr(topCategoryInsight.currentAmount)}.`,
        metadata: {
          category: topCategoryInsight.category,
          amountMinor: topCategoryInsight.currentAmount,
          percentageChange: topCategoryInsight.percentageChange,
        },
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
      periodType: ReportPeriodType;
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
    const previousPeriodStart =
      period.periodType === "weekly"
        ? subtractDays(period.periodStart, 7)
        : new Date(period.periodStart.getFullYear(), period.periodStart.getMonth() - 1, 1);
    const previousPeriodEnd =
      period.periodType === "weekly"
        ? period.periodStart
        : new Date(period.periodStart.getFullYear(), period.periodStart.getMonth(), 1);

    const previousPeriodExpenses = expensesForUser.filter(
      (item) => item.occurredAt >= previousPeriodStart && item.occurredAt < previousPeriodEnd,
    );

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
      summary: buildReportSummary(period.periodType, period.expensesForPeriod),
      metadata: buildReportMetadata(period.expensesForPeriod, previousPeriodExpenses),
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

  const [insightsForUser, recentExpenses, reportsForUser] = await Promise.all([
    db.select().from(insight).where(eq(insight.userId, userId)).orderBy(desc(insight.createdAt)).limit(8),
    db.select().from(expense).where(eq(expense.userId, userId)).orderBy(desc(expense.occurredAt)).limit(8),
    db
      .select()
      .from(report)
      .where(eq(report.userId, userId))
      .orderBy(desc(report.periodStart))
      .limit(4),
  ]);

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
