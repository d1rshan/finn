import {
  and,
  db,
  desc,
  eq,
  expense,
  gte,
  inArray,
  insight,
  lt,
  notification,
  report,
  session,
  user,
  type ExpenseCategory,
  type InsightMetadata,
  type InsightSummary,
} from "@finn/db";
import { createHash } from "node:crypto";

import { buildAnalyticsSnapshot, buildReportMetadataFromSnapshot } from "@/lib/analytics";
import { writeMorningBriefing, writeNarrative } from "@/lib/cron-copy";
import { listMemoryFactsForUser, rebuildFinancialMemoryGraph } from "@/lib/memory";
import { sendNotification } from "@/lib/notifier";
import {
  addDays,
  differenceInDays,
  getZonedParts,
  resolveTimeZone,
  startOfDay,
  zonedDayWindow,
  zonedMonthWindow,
  zonedWeekWindow,
} from "@/lib/time";

type UserRow = typeof user.$inferSelect;
type ExpenseRow = typeof expense.$inferSelect;
type InsightRow = typeof insight.$inferSelect;
type InsightInsert = typeof insight.$inferInsert;
type ReportInsert = typeof report.$inferInsert;

const OPEN_INSIGHT_STATUSES = ["active", "notified"] as const;
const SCHEDULER_INTERVAL_MS = 60_000;

type InsightCandidate = {
  key: string;
  type: InsightInsert["type"];
  severity: InsightInsert["severity"];
  title: string;
  body: string;
  metadata: InsightMetadata;
  createdAt?: Date;
};

function formatInr(amountMinor: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2)
    : (sorted[middle] ?? 0);
}

function sumExpenses(expensesForPeriod: ExpenseRow[]) {
  return expensesForPeriod.reduce((sum, entry) => sum + entry.amountMinor, 0);
}

function normalizeMerchant(merchantName: string) {
  return merchantName.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildFingerprint(candidate: InsightCandidate) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        title: candidate.title,
        body: candidate.body,
        severity: candidate.severity,
        metadata: candidate.metadata,
      }),
    )
    .digest("hex");
}

function buildInsightSummary(entries: InsightRow[]): InsightSummary[] {
  return entries.map((entry) => ({
    key: entry.key,
    title: entry.title,
    summary: entry.body,
    severity: entry.severity,
  }));
}

async function listExpensesForUser(args: {
  userId: string;
  since?: Date;
  until?: Date;
}) {
  const filters = [eq(expense.userId, args.userId)];
  if (args.since) {
    filters.push(gte(expense.occurredAt, args.since));
  }
  if (args.until) {
    filters.push(lt(expense.occurredAt, args.until));
  }

  return db
    .select()
    .from(expense)
    .where(and(...filters))
    .orderBy(desc(expense.occurredAt));
}

async function listOpenInsights(userId: string) {
  return db
    .select()
    .from(insight)
    .where(and(eq(insight.userId, userId), inArray(insight.status, [...OPEN_INSIGHT_STATUSES])))
    .orderBy(desc(insight.updatedAt));
}

async function upsertInsight(userId: string, candidate: InsightCandidate) {
  const fingerprint = buildFingerprint(candidate);
  const [existing] = await db
    .select()
    .from(insight)
    .where(and(eq(insight.userId, userId), eq(insight.key, candidate.key)))
    .limit(1);

  if (!existing) {
    const [created] = await db
      .insert(insight)
      .values({
        id: crypto.randomUUID(),
        key: candidate.key,
        userId,
        type: candidate.type,
        severity: candidate.severity,
        status: "active",
        title: candidate.title,
        body: candidate.body,
        metadata: {
          ...candidate.metadata,
          key: candidate.key,
        },
        createdAt: candidate.createdAt ?? new Date(),
        updatedAt: new Date(),
        lastEvaluatedAt: new Date(),
        resolvedAt: null,
        notificationHash: fingerprint,
      })
      .returning();

    if (!created) {
      throw new Error(`Failed to create insight ${candidate.key}`);
    }

    return created;
  }

  const unchanged = existing.notificationHash === fingerprint;
  const shouldPreserveNotified = unchanged && existing.status === "notified";
  const [saved] = await db
    .update(insight)
    .set({
      type: candidate.type,
      severity: candidate.severity,
      status: shouldPreserveNotified ? "notified" : "active",
      title: candidate.title,
      body: candidate.body,
      metadata: {
        ...existing.metadata,
        ...candidate.metadata,
        key: candidate.key,
        fingerprint: shouldPreserveNotified ? existing.metadata.fingerprint : undefined,
      },
      updatedAt: new Date(),
      lastEvaluatedAt: new Date(),
      resolvedAt: null,
      lastNotifiedAt: shouldPreserveNotified ? existing.lastNotifiedAt : null,
      notificationHash: fingerprint,
    })
    .where(eq(insight.id, existing.id))
    .returning();

  if (!saved) {
    throw new Error(`Failed to upsert insight ${candidate.key}`);
  }

  return saved;
}

async function resolveKeys(userId: string, keys: string[]) {
  if (keys.length === 0) {
    return;
  }

  await db
    .update(insight)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
      updatedAt: new Date(),
      lastEvaluatedAt: new Date(),
    })
    .where(and(eq(insight.userId, userId), inArray(insight.key, keys)));
}

async function resolveMissingCandidates(userId: string, type: InsightInsert["type"], activeKeys: string[]) {
  const existing = await db
    .select({ key: insight.key })
    .from(insight)
    .where(and(eq(insight.userId, userId), eq(insight.type, type), inArray(insight.status, [...OPEN_INSIGHT_STATUSES])));

  const stale = existing.map((entry) => entry.key).filter((key) => !activeKeys.includes(key));
  await resolveKeys(userId, stale);
}

function buildProjectionCandidates(expensesForWindow: ExpenseRow[], now: Date) {
  const snapshot = buildAnalyticsSnapshot({
    expenses: expensesForWindow,
    previousExpenses: [],
    now,
  });

  return snapshot.projections
    .filter((entry) => entry.projectedAmountMinor > entry.baselineAmountMinor * 1.2)
    .map(
      (entry) =>
        ({
          key: `projection:${entry.category}`,
          type: "projection",
          severity: entry.projectedAmountMinor > entry.baselineAmountMinor * 1.5 ? "high" : "medium",
          title: `${entry.category} is on pace to overshoot`,
          body: `${entry.category} is projected at ${formatInr(entry.projectedAmountMinor)} against a baseline of ${formatInr(entry.baselineAmountMinor)} this month.`,
          metadata: {
            category: entry.category,
            projectedAmountMinor: entry.projectedAmountMinor,
            baselineAmountMinor: entry.baselineAmountMinor,
            currentAmountMinor: entry.projectedAmountMinor,
          },
        }) satisfies InsightCandidate,
    );
}

function buildRecurringCandidates(expensesForWindow: ExpenseRow[]) {
  const groups = new Map<string, ExpenseRow[]>();

  for (const entry of expensesForWindow) {
    const key = `${normalizeMerchant(entry.merchantName)}:${entry.amountMinor}`;
    const current = groups.get(key) ?? [];
    current.push(entry);
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((entries) => {
      const sorted = [...entries].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
      if (sorted.length < 2) {
        return null;
      }

      const gaps = sorted.slice(1).map((entry, index) => differenceInDays(entry.occurredAt, sorted[index]!.occurredAt));
      const cadenceDays = median(gaps);
      if (cadenceDays < 25 || cadenceDays > 35) {
        return null;
      }

      const latest = sorted[sorted.length - 1];
      if (!latest) {
        return null;
      }

      return {
        key: `recurring:${normalizeMerchant(latest.merchantName)}:${latest.amountMinor}`,
        type: "recurring",
        severity: latest.amountMinor >= 20_000 ? "high" : "medium",
        title: `${latest.merchantName} looks recurring`,
        body: `A charge of ${formatInr(latest.amountMinor)} is repeating about every ${cadenceDays} days.`,
        metadata: {
          merchantName: latest.merchantName,
          amountMinor: latest.amountMinor,
          category: latest.category,
          cadenceDays,
          lastObservedAt: latest.occurredAt.toISOString(),
        },
        createdAt: latest.occurredAt,
      } satisfies InsightCandidate;
    })
    .flatMap((entry) => (entry ? [entry] : []));
}

function buildSilenceCandidates(expensesForWindow: ExpenseRow[], now: Date) {
  const categories = [...new Set(expensesForWindow.map((entry) => entry.category))];

  return categories
    .map((category) => {
      const entries = expensesForWindow
        .filter((entry) => entry.category === category)
        .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

      if (entries.length < 3) {
        return null;
      }

      const gaps = entries.slice(1).map((entry, index) => differenceInDays(entry.occurredAt, entries[index]!.occurredAt));
      const expectedGapDays = Math.max(1, Math.round(average(gaps)));
      const latest = entries[entries.length - 1];
      if (!latest) {
        return null;
      }

      const actualGapDays = Math.max(0, differenceInDays(now, latest.occurredAt));
      if (actualGapDays <= expectedGapDays * 1.5) {
        return null;
      }

      return {
        key: `silence:${category}`,
        type: "silence",
        severity: actualGapDays >= expectedGapDays * 2.5 ? "medium" : "low",
        title: `${category} has gone quiet`,
        body: `You usually spend in ${category} every ${expectedGapDays} days, but it has been ${actualGapDays} days.`,
        metadata: {
          category,
          expectedGapDays,
          actualGapDays,
          lastObservedAt: latest.occurredAt.toISOString(),
        },
        createdAt: latest.occurredAt,
      } satisfies InsightCandidate;
    })
    .flatMap((entry) => (entry ? [entry] : []));
}

function buildStreakCandidate(expensesForWindow: ExpenseRow[]) {
  const uniqueDays = [...new Set(expensesForWindow.map((entry) => startOfDay(entry.occurredAt).toISOString()))]
    .map((value) => new Date(value))
    .sort((a, b) => a.getTime() - b.getTime());

  if (uniqueDays.length < 4) {
    return null;
  }

  let currentStreak = 1;
  let bestStreak = 1;

  for (let index = 1; index < uniqueDays.length; index += 1) {
    const current = uniqueDays[index];
    const previous = uniqueDays[index - 1];
    if (!current || !previous) {
      continue;
    }

    if (differenceInDays(current, previous) === 1) {
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  if (bestStreak <= 3) {
    return null;
  }

  return {
    key: "streak:expense-days",
    type: "streak",
    severity: bestStreak >= 7 ? "medium" : "low",
    title: "A daily spend streak is forming",
    body: `You have recorded at least one expense on ${bestStreak} consecutive days.`,
    metadata: {
      count: bestStreak,
      streakDays: bestStreak,
    },
    createdAt: uniqueDays[uniqueDays.length - 1],
  } satisfies InsightCandidate;
}

function buildBehaviorCandidates(expensesForWindow: ExpenseRow[], now: Date) {
  const currentWindowStart = addDays(now, -90);
  const previousWindowStart = addDays(now, -180);
  const currentWindow = expensesForWindow.filter((entry) => entry.occurredAt >= currentWindowStart);
  const previousWindow = expensesForWindow.filter(
    (entry) => entry.occurredAt >= previousWindowStart && entry.occurredAt < currentWindowStart,
  );

  const snapshot = buildAnalyticsSnapshot({
    expenses: currentWindow,
    previousExpenses: previousWindow,
    now,
  });

  const candidates: InsightCandidate[] = [];
  const strongestDay = [...snapshot.dayOfWeekSpend].sort((a, b) => b.averageAmountMinor - a.averageAmountMinor)[0];
  if (strongestDay && strongestDay.averageAmountMinor > 0) {
    candidates.push({
      key: `behavior:day:${strongestDay.day}`,
      type: "behavior-pattern",
      severity: "low",
      title: `${strongestDay.day} is your spend-heavy day`,
      body: `Your average spend is highest on ${strongestDay.day}, which makes it your current spend-heavy day.`,
      metadata: {
        summary: `Average ${strongestDay.day} spend is ${formatInr(strongestDay.averageAmountMinor)}.`,
      },
    });
  }

  if (snapshot.endOfMonthCrunch) {
    candidates.push({
      key: "behavior:month-end-throttle",
      type: "behavior-pattern",
      severity: "low",
      title: "You tighten up near month-end",
      body: snapshot.endOfMonthCrunch,
      metadata: {
        summary: snapshot.endOfMonthCrunch,
      },
    });
  }

  if (snapshot.persona) {
    candidates.push({
      key: "behavior:persona",
      type: "behavior-pattern",
      severity: "low",
      title: snapshot.persona.label,
      body: snapshot.persona.summary,
      metadata: {
        personaLabel: snapshot.persona.label,
        summary: snapshot.persona.summary,
      },
    });
  }

  const currentCategoryTotals = new Map<ExpenseCategory, number>();
  const previousCategoryTotals = new Map<ExpenseCategory, number>();
  for (const entry of currentWindow) {
    currentCategoryTotals.set(entry.category, (currentCategoryTotals.get(entry.category) ?? 0) + entry.amountMinor);
  }
  for (const entry of previousWindow) {
    previousCategoryTotals.set(entry.category, (previousCategoryTotals.get(entry.category) ?? 0) + entry.amountMinor);
  }

  for (const [category, currentAmountMinor] of currentCategoryTotals.entries()) {
    const previousAmountMinor = previousCategoryTotals.get(category) ?? 0;
    if (previousAmountMinor > 0 && currentAmountMinor > previousAmountMinor * 1.2) {
      candidates.push({
        key: `behavior:category-drift:${category}`,
        type: "behavior-pattern",
        severity: currentAmountMinor > previousAmountMinor * 1.5 ? "medium" : "low",
        title: `${category} is drifting upward`,
        body: `${category} spend is climbing against the prior 90-day window.`,
        metadata: {
          category,
          currentAmountMinor,
          previousAmountMinor,
        },
      });
    }
  }

  return candidates;
}

async function canNotify(userId: string, insightRow: InsightRow) {
  const recentCutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const [recentNotification] = await db
    .select()
    .from(notification)
    .where(and(eq(notification.userId, userId), eq(notification.channel, "push"), gte(notification.createdAt, recentCutoff)))
    .orderBy(desc(notification.createdAt))
    .limit(1);

  if (recentNotification) {
    return false;
  }

  return !(
    insightRow.status === "notified" &&
    insightRow.lastNotifiedAt &&
    insightRow.metadata.fingerprint === insightRow.notificationHash
  );
}

async function maybeNotifyHighSeverity(userRow: UserRow, insightRow: InsightRow) {
  if (insightRow.severity !== "high") {
    return;
  }

  const allowed = await canNotify(userRow.id, insightRow);
  if (!allowed) {
    return;
  }

  const body = await writeNarrative({
    title: insightRow.title,
    style: "push",
    metrics: {
      severity: insightRow.severity,
      body: insightRow.body,
      metadata: insightRow.metadata,
    },
    insights: buildInsightSummary([insightRow]),
  });

  const sent = await sendNotification({
    userId: userRow.id,
    channel: "push",
    title: "Finn spotted something",
    body,
    metadata: {
      insightId: insightRow.id,
      insightKey: insightRow.key,
      payload: {
        severity: insightRow.severity,
      },
    },
  });

  if (sent.status !== "sent" || !sent.deliveredAt) {
    return;
  }

  await db
    .update(insight)
    .set({
      status: "notified",
      updatedAt: new Date(),
      lastNotifiedAt: sent.deliveredAt,
      metadata: {
        ...insightRow.metadata,
        fingerprint: insightRow.notificationHash ?? undefined,
      },
    })
    .where(eq(insight.id, insightRow.id));
}

async function upsertReport(args: ReportInsert) {
  const [saved] = await db
    .insert(report)
    .values(args)
    .onConflictDoUpdate({
      target: [report.userId, report.periodType, report.periodStart],
      set: {
        periodEnd: args.periodEnd,
        title: args.title,
        summary: args.summary,
        metadata: args.metadata,
      },
    })
    .returning();

  if (!saved) {
    throw new Error("Failed to upsert report");
  }

  return saved;
}

async function buildWeeklyReport(userId: string, now: Date, timeZone: string) {
  const reportWeek = zonedWeekWindow(now, timeZone, -1);
  const comparisonWeek = zonedWeekWindow(now, timeZone, -2);
  const [expensesForWeek, previousWeekExpenses, activeInsights] = await Promise.all([
    listExpensesForUser({ userId, since: reportWeek.start, until: reportWeek.end }),
    listExpensesForUser({ userId, since: comparisonWeek.start, until: comparisonWeek.end }),
    listOpenInsights(userId),
  ]);

  const snapshot = buildAnalyticsSnapshot({
    expenses: expensesForWeek,
    previousExpenses: previousWeekExpenses,
    now: reportWeek.end,
  });
  const metadata = buildReportMetadataFromSnapshot(snapshot);
  const summary = await writeNarrative({
    title: "Your week in money",
    style: "weekly",
    metrics: {
      totalSpend: sumExpenses(expensesForWeek),
      categoryBreakdown: metadata.topCategories,
      biggestSingleTransaction:
        [...expensesForWeek].sort((a, b) => b.amountMinor - a.amountMinor)[0] ?? null,
      vsPreviousWeekDelta: snapshot.metrics[0]?.change ?? null,
      activeInsights: buildInsightSummary(activeInsights).slice(0, 4),
    },
    insights: buildInsightSummary(activeInsights),
  });

  return {
    periodStart: reportWeek.start,
    periodEnd: reportWeek.end,
    summary,
    metadata,
  };
}

async function buildMonthlyWrapped(userId: string, now: Date, timeZone: string) {
  const bounds = zonedMonthWindow(now, timeZone, -1);
  const previousBounds = zonedMonthWindow(now, timeZone, -2);
  const [expensesForMonth, previousMonth, activeInsights] = await Promise.all([
    listExpensesForUser({ userId, since: bounds.start, until: bounds.end }),
    listExpensesForUser({ userId, since: previousBounds.start, until: previousBounds.end }),
    listOpenInsights(userId),
  ]);

  const snapshot = buildAnalyticsSnapshot({
    expenses: expensesForMonth,
    previousExpenses: previousMonth,
    now: bounds.end,
  });
  const metadata = buildReportMetadataFromSnapshot(snapshot);
  const merchantCounts = expensesForMonth.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.merchantName] = (acc[entry.merchantName] ?? 0) + 1;
    return acc;
  }, {});
  const mostVisitedMerchant = Object.entries(merchantCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const recurringChargesTotal = snapshot.recurringCharges.reduce((sum, entry) => sum + entry.amountMinor, 0);

  const summary = await writeNarrative({
    title: `${bounds.start.toLocaleDateString("en-IN", { month: "long", timeZone })} Wrapped`,
    style: "monthly",
    metrics: {
      totalSpend: sumExpenses(expensesForMonth),
      vsMonthBefore: snapshot.metrics[0]?.change ?? null,
      categoryBreakdown: metadata.topCategories,
      mostVisitedMerchant,
      recurringChargesTotal,
      persona: metadata.persona,
      activeInsights: buildInsightSummary(activeInsights).slice(0, 4),
    },
    insights: buildInsightSummary(activeInsights),
  });

  return {
    periodStart: bounds.start,
    periodEnd: bounds.end,
    summary,
    metadata,
  };
}

async function refreshOpenStateForUser(userId: string, now: Date, notify: boolean) {
  const expensesForUser = await listExpensesForUser({
    userId,
    since: addDays(now, -90),
  });

  const last30Days = expensesForUser.filter((entry) => entry.occurredAt >= addDays(now, -30));
  const userRows = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  const userRow = userRows[0];
  if (!userRow) {
    return;
  }

  const projectionCandidates = buildProjectionCandidates(last30Days, now);
  const recurringCandidates = buildRecurringCandidates(last30Days);
  const silenceCandidates = buildSilenceCandidates(last30Days, now);
  const streakCandidate = buildStreakCandidate(last30Days);
  const behaviorCandidates = buildBehaviorCandidates(expensesForUser, now);

  const allCandidates = [
    ...projectionCandidates,
    ...recurringCandidates,
    ...silenceCandidates,
    ...(streakCandidate ? [streakCandidate] : []),
    ...behaviorCandidates,
  ];

  const savedInsights: InsightRow[] = [];
  for (const candidate of allCandidates) {
    savedInsights.push(await upsertInsight(userId, candidate));
  }

  await Promise.all([
    resolveMissingCandidates(userId, "projection", projectionCandidates.map((entry) => entry.key)),
    resolveMissingCandidates(userId, "recurring", recurringCandidates.map((entry) => entry.key)),
    resolveMissingCandidates(userId, "silence", silenceCandidates.map((entry) => entry.key)),
    resolveMissingCandidates(userId, "streak", streakCandidate ? [streakCandidate.key] : []),
    resolveMissingCandidates(userId, "behavior-pattern", behaviorCandidates.map((entry) => entry.key)),
  ]);

  await rebuildFinancialMemoryGraph(userId, expensesForUser);

  if (notify) {
    for (const insightRow of savedInsights) {
      await maybeNotifyHighSeverity(userRow, insightRow);
    }
  }
}

async function activeUsersInLast24Hours(now: Date) {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [expenseRows, sessionRows] = await Promise.all([
    db.select({ userId: expense.userId }).from(expense).where(gte(expense.occurredAt, cutoff)),
    db.select({ userId: session.userId }).from(session).where(gte(session.updatedAt, cutoff)),
  ]);

  const ids = [...new Set([...expenseRows, ...sessionRows].map((entry) => entry.userId))];
  if (ids.length === 0) {
    return [] as UserRow[];
  }

  return db.select().from(user).where(inArray(user.id, ids));
}

export async function refreshUserAnalyticsState(userId: string, now = new Date()) {
  await refreshOpenStateForUser(userId, now, false);

  const [userRow] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  if (!userRow) {
    return;
  }
  const timeZone = resolveTimeZone(userRow.timezone);

  const [weekly, monthly] = await Promise.all([
    buildWeeklyReport(userId, now, timeZone),
    buildMonthlyWrapped(userId, now, timeZone),
  ]);

  await Promise.all([
    upsertReport({
      id: crypto.randomUUID(),
      userId,
      periodType: "weekly",
      periodStart: weekly.periodStart,
      periodEnd: weekly.periodEnd,
      title: "Your week in money",
      summary: weekly.summary,
      metadata: weekly.metadata,
      createdAt: new Date(),
    }),
    upsertReport({
      id: crypto.randomUUID(),
      userId,
      periodType: "monthly",
      periodStart: monthly.periodStart,
      periodEnd: monthly.periodEnd,
      title: `Your ${monthly.periodStart.toLocaleDateString("en-IN", { month: "long", timeZone })} Wrapped`,
      summary: monthly.summary,
      metadata: monthly.metadata,
      createdAt: new Date(),
    }),
  ]);
}

export async function runHourlyInsightSweep(now = new Date()) {
  const activeUsers = await activeUsersInLast24Hours(now);
  for (const userRow of activeUsers) {
    await refreshOpenStateForUser(userRow.id, now, true);
  }
}

export async function runDailyMorningBriefing(now = new Date()) {
  const users = await db.select().from(user);
  for (const userRow of users) {
    const parts = getZonedParts(now, resolveTimeZone(userRow.timezone));
    if (parts.hour !== 8 || parts.minute !== 0) {
      continue;
    }

    const { start: yesterdayStart, end: yesterdayEnd } = zonedDayWindow(
      now,
      resolveTimeZone(userRow.timezone),
      -1,
    );
    const [yesterdayExpenses, activeInsights] = await Promise.all([
      listExpensesForUser({ userId: userRow.id, since: yesterdayStart, until: yesterdayEnd }),
      listOpenInsights(userRow.id),
    ]);
    const yesterdayTotalMinor = sumExpenses(yesterdayExpenses);
    const briefing = await writeMorningBriefing({
      yesterdayTotalMinor,
      yesterdayCount: yesterdayExpenses.length,
      topMerchant:
        [...yesterdayExpenses].sort((a, b) => b.amountMinor - a.amountMinor)[0]?.merchantName ?? null,
      insights: buildInsightSummary(activeInsights),
    });

    await sendNotification({
      userId: userRow.id,
      channel: "briefing",
      title: "Your financial pulse",
      body: briefing,
      metadata: {
        payload: {
          kind: "morning-briefing",
        },
      },
    });
  }
}

export async function runWeeklyReportGenerator(now = new Date()) {
  const users = await db.select().from(user);
  for (const userRow of users) {
    const timeZone = resolveTimeZone(userRow.timezone);
    const parts = getZonedParts(now, timeZone);
    if (parts.weekday !== 1 || parts.hour !== 9 || parts.minute !== 0) {
      continue;
    }

    const weekly = await buildWeeklyReport(userRow.id, now, timeZone);
    const saved = await upsertReport({
      id: crypto.randomUUID(),
      userId: userRow.id,
      periodType: "weekly",
      periodStart: weekly.periodStart,
      periodEnd: weekly.periodEnd,
      title: "Your week in money",
      summary: weekly.summary,
      metadata: weekly.metadata,
      createdAt: new Date(),
    });

    await sendNotification({
      userId: userRow.id,
      channel: "report",
      title: "Your weekly Finn report is ready",
      body: "Your week in money is ready.",
      metadata: {
        reportId: saved.id,
        reportPeriodType: "weekly",
      },
    });
  }
}

export async function runMonthlyWrapped(now = new Date()) {
  const users = await db.select().from(user);
  for (const userRow of users) {
    const timeZone = resolveTimeZone(userRow.timezone);
    const parts = getZonedParts(now, timeZone);
    if (parts.day !== 1 || parts.hour !== 10 || parts.minute !== 0) {
      continue;
    }

    const monthly = await buildMonthlyWrapped(userRow.id, now, timeZone);
    const title = `Your ${monthly.periodStart.toLocaleDateString("en-IN", { month: "long", timeZone })} Wrapped`;
    const saved = await upsertReport({
      id: crypto.randomUUID(),
      userId: userRow.id,
      periodType: "monthly",
      periodStart: monthly.periodStart,
      periodEnd: monthly.periodEnd,
      title,
      summary: monthly.summary,
      metadata: monthly.metadata,
      createdAt: new Date(),
    });

    await sendNotification({
      userId: userRow.id,
      channel: "report",
      title,
      body: `${monthly.periodStart.toLocaleDateString("en-IN", { month: "long" })} Wrapped is ready.`,
      metadata: {
        reportId: saved.id,
        reportPeriodType: "monthly",
      },
    });
  }
}

export async function runInsightStalenessCleanup(now = new Date()) {
  const staleBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const staleInsights = await db
    .select()
    .from(insight)
    .where(and(inArray(insight.status, [...OPEN_INSIGHT_STATUSES]), lt(insight.updatedAt, staleBefore)));

  for (const staleInsight of staleInsights) {
    if (staleInsight.type === "behavior-pattern") {
      await resolveKeys(staleInsight.userId, [staleInsight.key]);
      continue;
    }

    const recentExpenses = await listExpensesForUser({
      userId: staleInsight.userId,
      since: addDays(now, -90),
    });
    const last30Days = recentExpenses.filter((entry) => entry.occurredAt >= addDays(now, -30));

    const stillPresent =
      staleInsight.type === "projection"
        ? buildProjectionCandidates(last30Days, now).some((entry) => entry.key === staleInsight.key)
        : staleInsight.type === "recurring"
          ? buildRecurringCandidates(last30Days).some((entry) => entry.key === staleInsight.key)
          : staleInsight.type === "silence"
            ? buildSilenceCandidates(last30Days, now).some((entry) => entry.key === staleInsight.key)
            : staleInsight.type === "streak"
              ? buildStreakCandidate(last30Days)?.key === staleInsight.key
              : true;

    if (!stillPresent) {
      await resolveKeys(staleInsight.userId, [staleInsight.key]);
    }
  }
}

export async function runBehaviorPatternRefresh(now = new Date()) {
  const users = await db.select().from(user);
  for (const userRow of users) {
    const parts = getZonedParts(now, resolveTimeZone(userRow.timezone));
    if (parts.weekday !== 0 || parts.hour !== 3 || parts.minute !== 0) {
      continue;
    }

    await refreshOpenStateForUser(userRow.id, now, false);
  }
}

const schedulerSlots = new Map<string, string>();

function shouldRun(key: string, slot: string) {
  const previous = schedulerSlots.get(key);
  if (previous === slot) {
    return false;
  }

  schedulerSlots.set(key, slot);
  return true;
}

export function startScheduler() {
  const tick = async () => {
    const now = new Date();
    const slot = now.toISOString().slice(0, 16);

    if (now.getUTCMinutes() === 0 && shouldRun("hourly", slot)) {
      await runHourlyInsightSweep(now);
    }

    if (now.getUTCHours() === 2 && now.getUTCMinutes() === 0 && shouldRun("cleanup", slot)) {
      await runInsightStalenessCleanup(now);
    }

    if (now.getUTCMinutes() === 0 && shouldRun("timezone-jobs", slot)) {
      await runDailyMorningBriefing(now);
      await runWeeklyReportGenerator(now);
      await runMonthlyWrapped(now);
      await runBehaviorPatternRefresh(now);
    }
  };

  void tick();
  return setInterval(() => {
    void tick();
  }, SCHEDULER_INTERVAL_MS);
}

export async function listStoredReports(userId: string) {
  return db.select().from(report).where(eq(report.userId, userId)).orderBy(desc(report.periodStart));
}

export async function buildAskContextMemoryFacts(userId: string) {
  return listMemoryFactsForUser(userId, 6);
}
