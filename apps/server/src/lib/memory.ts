import {
  db,
  desc,
  eq,
  expenseCategories,
  memoryEdge,
  memoryFact,
  memoryNode,
  memoryObservation,
  type ExpenseCategory,
  type MemoryEdgeMetadata,
  type MemoryNodeMetadata,
} from "@finn/db";

import type { ExpenseLike } from "@/lib/analytics";

type MemoryExpense = Pick<
  ExpenseLike,
  "id" | "userId" | "amountMinor" | "merchantName" | "category" | "occurredAt" | "note"
>;
type MemoryNodeInsert = typeof memoryNode.$inferInsert;
type MemoryEdgeInsert = typeof memoryEdge.$inferInsert;
type MemoryFactInsert = typeof memoryFact.$inferInsert;
type MemoryObservationInsert = typeof memoryObservation.$inferInsert;

type TimeBucket = NonNullable<MemoryNodeMetadata["timeBucket"]>;
type DayBucket = NonNullable<MemoryNodeMetadata["dayBucket"]>;
type SalaryWindow = NonNullable<MemoryNodeMetadata["salaryWindow"]>;

const MERCHANT_STOP_WORDS = new Set([
  "ltd",
  "limited",
  "pvt",
  "private",
  "inc",
  "llp",
  "co",
  "company",
  "services",
  "service",
  "technologies",
  "technology",
  "tech",
  "india",
  "payment",
  "payments",
]);

const TIME_BUCKET_ORDER: TimeBucket[] = [
  "early-morning",
  "morning",
  "afternoon",
  "evening",
  "late-night",
];

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCurrency(amountMinor: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

function formatCategory(category: ExpenseCategory) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function differenceInDays(later: Date, earlier: Date) {
  const laterStart = new Date(later.getFullYear(), later.getMonth(), later.getDate());
  const earlierStart = new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.round((laterStart.getTime() - earlierStart.getTime()) / 86_400_000);
}

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniqueDayCount(expensesForBucket: MemoryExpense[]) {
  return new Set(
    expensesForBucket.map((entry) =>
      new Date(
        entry.occurredAt.getFullYear(),
        entry.occurredAt.getMonth(),
        entry.occurredAt.getDate(),
      ).toISOString(),
    ),
  ).size;
}

function normalizeMerchantName(rawMerchantName: string) {
  const trimmed = collapseWhitespace(rawMerchantName);
  const normalized = trimmed
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part && !MERCHANT_STOP_WORDS.has(part))
    .join(" ")
    .trim();

  const key = normalized || trimmed.toLowerCase();

  return {
    raw: trimmed,
    key,
    label: titleCase(key),
  };
}

function normalizeNote(note?: string | null) {
  if (!note) {
    return undefined;
  }

  const normalized = collapseWhitespace(note);
  return normalized.length ? normalized : undefined;
}

function deriveTimeBucket(date: Date): TimeBucket {
  const hour = date.getHours();

  if (hour >= 5 && hour < 9) {
    return "early-morning";
  }

  if (hour < 13) {
    return "morning";
  }

  if (hour < 17) {
    return "afternoon";
  }

  if (hour < 21) {
    return "evening";
  }

  return "late-night";
}

function deriveDayBucket(date: Date): DayBucket {
  return date.getDay() === 0 || date.getDay() === 6 ? "weekend" : "weekday";
}

function deriveSalaryWindow(date: Date): SalaryWindow {
  const day = date.getDate();

  if (day <= 5) {
    return "early-month";
  }

  if (day <= 20) {
    return "mid-month";
  }

  return "month-end";
}

function createNodeLabel(type: MemoryNodeInsert["type"], rawValue: string) {
  if (type === "time-bucket" || type === "salary-window" || type === "day-bucket") {
    return titleCase(rawValue.replace(/-/g, " "));
  }

  if (type === "category") {
    return formatCategory(rawValue as ExpenseCategory);
  }

  return rawValue;
}

function mergeNodeMetadata(
  current: MemoryNodeMetadata,
  next: MemoryNodeMetadata,
): MemoryNodeMetadata {
  const rawMerchantNames = [
    ...(current.rawMerchantNames ?? []),
    ...(next.rawMerchantNames ?? []),
  ];

  return {
    ...current,
    ...next,
    rawMerchantNames: rawMerchantNames.length ? [...new Set(rawMerchantNames)].slice(0, 6) : undefined,
  };
}

export function normalizeExpenseInput(input: {
  merchantName: string;
  note?: string | null;
}) {
  return {
    merchantName: collapseWhitespace(input.merchantName),
    note: normalizeNote(input.note),
  };
}

function buildFinancialMemoryGraph(userId: string, expensesForUser: MemoryExpense[]) {
  const now = new Date();
  const recentWindowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  const baselineWindowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);

  const nodes = new Map<string, typeof memoryNode.$inferInsert>();
  const edgeAccumulators = new Map<
    string,
    {
      fromNodeId: string;
      toNodeId: string;
      relation: MemoryEdgeInsert["relation"];
      supportCount: number;
      totalAmountMinor: number;
      metadata: MemoryEdgeMetadata;
    }
  >();
  const facts: MemoryFactInsert[] = [];
  const observations: MemoryObservationInsert[] = [];
  const merchantGroups = new Map<string, MemoryExpense[]>();
  const merchantRawNames = new Map<string, Set<string>>();
  const merchantCategoryCounts = new Map<string, Map<ExpenseCategory, number>>();
  const timeBucketGroups = new Map<TimeBucket, MemoryExpense[]>();
  const dayBucketGroups = new Map<DayBucket, MemoryExpense[]>();
  const salaryWindowGroups = new Map<SalaryWindow, MemoryExpense[]>();

  function ensureNode(args: {
    type: typeof memoryNode.$inferInsert.type;
    value: string;
    label?: string;
    confidence?: number;
    metadata?: MemoryNodeMetadata;
  }) {
    const key = `${args.type}:${args.value}`;
    const existing = nodes.get(key);

    if (existing) {
      existing.confidence = Math.max(existing.confidence ?? 0, args.confidence ?? 100);
      existing.metadata = mergeNodeMetadata(existing.metadata ?? {}, args.metadata ?? {});
      return existing;
    }

    const created: MemoryNodeInsert = {
      id: crypto.randomUUID(),
      userId,
      type: args.type,
      key,
      label: args.label ?? createNodeLabel(args.type, args.value),
      confidence: args.confidence ?? 100,
      metadata: args.metadata ?? {},
    };

    nodes.set(key, created);
    return created;
  }

  function accumulateEdge(args: {
    fromNodeId: string;
    toNodeId: string;
    relation: MemoryEdgeInsert["relation"];
    amountMinor: number;
    metadata?: MemoryEdgeMetadata;
  }) {
    const key = `${args.fromNodeId}:${args.relation}:${args.toNodeId}`;
    const current = edgeAccumulators.get(key) ?? {
      fromNodeId: args.fromNodeId,
      toNodeId: args.toNodeId,
      relation: args.relation,
      supportCount: 0,
      totalAmountMinor: 0,
      metadata: {},
    };

    current.supportCount += 1;
    current.totalAmountMinor += args.amountMinor;
    current.metadata = { ...current.metadata, ...args.metadata };
    edgeAccumulators.set(key, current);
  }

  for (const entry of expensesForUser) {
    const merchant = normalizeMerchantName(entry.merchantName);
    const timeBucket = deriveTimeBucket(entry.occurredAt);
    const dayBucket = deriveDayBucket(entry.occurredAt);
    const salaryWindow = deriveSalaryWindow(entry.occurredAt);

    const merchantNode = ensureNode({
      type: "merchant",
      value: merchant.key,
      label: merchant.label,
      metadata: {
        normalizedMerchantName: merchant.key,
        rawMerchantNames: [merchant.raw],
      },
      confidence: 96,
    });
    const categoryNode = ensureNode({
      type: "category",
      value: entry.category,
      metadata: {
        category: entry.category,
      },
    });
    const timeNode = ensureNode({
      type: "time-bucket",
      value: timeBucket,
      metadata: {
        timeBucket,
      },
      confidence: 84,
    });
    const dayNode = ensureNode({
      type: "day-bucket",
      value: dayBucket,
      metadata: {
        dayBucket,
      },
      confidence: 84,
    });
    const salaryNode = ensureNode({
      type: "salary-window",
      value: salaryWindow,
      metadata: {
        salaryWindow,
      },
      confidence: 78,
    });

    accumulateEdge({
      fromNodeId: merchantNode.id,
      toNodeId: categoryNode.id,
      relation: "categorized-as",
      amountMinor: entry.amountMinor,
      metadata: {
        category: entry.category,
      },
    });
    accumulateEdge({
      fromNodeId: merchantNode.id,
      toNodeId: timeNode.id,
      relation: "peaks-in",
      amountMinor: entry.amountMinor,
      metadata: {
        timeBucket,
      },
    });
    accumulateEdge({
      fromNodeId: merchantNode.id,
      toNodeId: dayNode.id,
      relation: "spikes-on",
      amountMinor: entry.amountMinor,
      metadata: {
        dayBucket,
      },
    });
    accumulateEdge({
      fromNodeId: merchantNode.id,
      toNodeId: salaryNode.id,
      relation: "clusters-in",
      amountMinor: entry.amountMinor,
      metadata: {
        salaryWindow,
      },
    });

    const merchantEntries = merchantGroups.get(merchant.key) ?? [];
    merchantEntries.push(entry);
    merchantGroups.set(merchant.key, merchantEntries);

    const rawNames = merchantRawNames.get(merchant.key) ?? new Set<string>();
    rawNames.add(merchant.raw);
    merchantRawNames.set(merchant.key, rawNames);

    const categoryCounts = merchantCategoryCounts.get(merchant.key) ?? new Map<ExpenseCategory, number>();
    categoryCounts.set(entry.category, (categoryCounts.get(entry.category) ?? 0) + 1);
    merchantCategoryCounts.set(merchant.key, categoryCounts);

    const timeEntries = timeBucketGroups.get(timeBucket) ?? [];
    timeEntries.push(entry);
    timeBucketGroups.set(timeBucket, timeEntries);

    const dayEntries = dayBucketGroups.get(dayBucket) ?? [];
    dayEntries.push(entry);
    dayBucketGroups.set(dayBucket, dayEntries);

    const salaryEntries = salaryWindowGroups.get(salaryWindow) ?? [];
    salaryEntries.push(entry);
    salaryWindowGroups.set(salaryWindow, salaryEntries);

    observations.push({
      id: crypto.randomUUID(),
      userId,
      expenseId: entry.id,
      memoryNodeId: merchantNode.id,
      metadata: {
        normalizedMerchantName: merchant.key,
        timeBucket,
        dayBucket,
        salaryWindow,
      },
      createdAt: entry.occurredAt,
    });
  }

  const totalSpend = expensesForUser.reduce((sum, entry) => sum + entry.amountMinor, 0);

  for (const [merchantKey, entries] of merchantGroups.entries()) {
    const sorted = [...entries].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    if (sorted.length < 3) {
      continue;
    }

    const gaps = sorted.slice(1).map((entry, index) => differenceInDays(entry.occurredAt, sorted[index]!.occurredAt));
    const averageGapDays = Math.round(average(gaps));
    const maxGapDeviation = Math.max(...gaps.map((gap) => Math.abs(gap - averageGapDays)));

    if (averageGapDays < 5 || averageGapDays > 45 || maxGapDeviation > 10) {
      continue;
    }

    const merchantLabel = normalizeMerchantName(sorted[0]!.merchantName).label;
    const meanAmount = Math.round(average(sorted.map((entry) => entry.amountMinor)));
    const factId = crypto.randomUUID();

    facts.push({
      id: factId,
      userId,
      kind: "recurring-merchant",
      status: "active",
      title: `${merchantLabel} looks like a recurring habit`,
      body: `${merchantLabel} has shown up ${sorted.length} times with an average cadence of ${averageGapDays} days at roughly ${formatCurrency(meanAmount)}.`,
      confidence: 88,
      evidence: {
        expenseIds: sorted.slice(-4).map((entry) => entry.id),
        relatedNodeKeys: [`merchant:${merchantKey}`],
        merchantName: merchantLabel,
        sampleSize: sorted.length,
        averageGapDays,
      },
      validFrom: sorted[0]!.occurredAt,
      validTo: sorted[sorted.length - 1]!.occurredAt,
      createdAt: sorted[sorted.length - 1]!.occurredAt,
    });

    for (const supportingExpense of sorted.slice(-4)) {
      observations.push({
        id: crypto.randomUUID(),
        userId,
        expenseId: supportingExpense.id,
        memoryFactId: factId,
        metadata: {
          normalizedMerchantName: merchantKey,
        },
        createdAt: supportingExpense.occurredAt,
      });
    }
  }

  const topTimeBucket = TIME_BUCKET_ORDER.map((bucket) => {
    const entries = timeBucketGroups.get(bucket) ?? [];
    const amountMinor = entries.reduce((sum, entry) => sum + entry.amountMinor, 0);
    return {
      bucket,
      entries,
      amountMinor,
      share: totalSpend > 0 ? amountMinor / totalSpend : 0,
    };
  }).sort((a, b) => b.share - a.share)[0];

  if (topTimeBucket && topTimeBucket.entries.length >= 3 && topTimeBucket.share >= 0.34) {
    const factId = crypto.randomUUID();
    facts.push({
      id: factId,
      userId,
      kind: "time-of-day",
      status: "active",
      title: `${createNodeLabel("time-bucket", topTimeBucket.bucket)} is a strong spending window`,
      body: `${Math.round(topTimeBucket.share * 100)}% of your logged spend lands in ${createNodeLabel("time-bucket", topTimeBucket.bucket).toLowerCase()}, which Finn should treat as a default behavior window.`,
      confidence: 82,
      evidence: {
        expenseIds: topTimeBucket.entries.slice(-5).map((entry) => entry.id),
        relatedNodeKeys: [`time-bucket:${topTimeBucket.bucket}`],
        timeBucket: topTimeBucket.bucket,
        sampleSize: topTimeBucket.entries.length,
      },
      validFrom: topTimeBucket.entries[0]!.occurredAt,
      validTo: topTimeBucket.entries[topTimeBucket.entries.length - 1]!.occurredAt,
      createdAt: now,
    });
  }

  const weekendEntries = dayBucketGroups.get("weekend") ?? [];
  const weekdayEntries = dayBucketGroups.get("weekday") ?? [];
  const weekendAveragePerActiveDay =
    weekendEntries.reduce((sum, entry) => sum + entry.amountMinor, 0) /
    Math.max(uniqueDayCount(weekendEntries), 1);
  const weekdayAveragePerActiveDay =
    weekdayEntries.reduce((sum, entry) => sum + entry.amountMinor, 0) /
    Math.max(uniqueDayCount(weekdayEntries), 1);

  if (
    weekendEntries.length >= 3 &&
    weekdayEntries.length >= 3 &&
    weekendAveragePerActiveDay >= weekdayAveragePerActiveDay * 1.35
  ) {
    const factId = crypto.randomUUID();
    facts.push({
      id: factId,
      userId,
      kind: "weekend-pattern",
      status: "active",
      title: "Weekends carry a heavier spend load",
      body: `Your average active weekend day is running at ${formatCurrency(Math.round(weekendAveragePerActiveDay))}, which is materially above your weekday pace of ${formatCurrency(Math.round(weekdayAveragePerActiveDay))}.`,
      confidence: 84,
      evidence: {
        expenseIds: weekendEntries.slice(-5).map((entry) => entry.id),
        relatedNodeKeys: ["day-bucket:weekend", "day-bucket:weekday"],
        dayBucket: "weekend",
        sampleSize: weekendEntries.length + weekdayEntries.length,
      },
      validFrom: weekendEntries[0]!.occurredAt,
      validTo: weekendEntries[weekendEntries.length - 1]!.occurredAt,
      createdAt: now,
    });
  }

  const earlyMonthEntries = salaryWindowGroups.get("early-month") ?? [];
  const monthEndEntries = salaryWindowGroups.get("month-end") ?? [];
  const earlyMonthShare =
    totalSpend > 0
      ? earlyMonthEntries.reduce((sum, entry) => sum + entry.amountMinor, 0) / totalSpend
      : 0;
  const monthEndShare =
    totalSpend > 0
      ? monthEndEntries.reduce((sum, entry) => sum + entry.amountMinor, 0) / totalSpend
      : 0;
  const dominantSalaryWindow = earlyMonthShare >= monthEndShare ? "early-month" : "month-end";
  const dominantSalaryShare = Math.max(earlyMonthShare, monthEndShare);
  const dominantSalaryEntries =
    dominantSalaryWindow === "early-month" ? earlyMonthEntries : monthEndEntries;

  if (dominantSalaryEntries.length >= 3 && dominantSalaryShare >= 0.28) {
    const factId = crypto.randomUUID();
    facts.push({
      id: factId,
      userId,
      kind: "salary-cycle",
      status: "active",
      title: `${createNodeLabel("salary-window", dominantSalaryWindow)} drives your monthly spend rhythm`,
      body: `${Math.round(dominantSalaryShare * 100)}% of your logged spend clusters in ${createNodeLabel("salary-window", dominantSalaryWindow).toLowerCase()}, giving Finn a working salary-cycle anchor even before bank-linked income data exists.`,
      confidence: 76,
      evidence: {
        expenseIds: dominantSalaryEntries.slice(-5).map((entry) => entry.id),
        relatedNodeKeys: [`salary-window:${dominantSalaryWindow}`],
        salaryWindow: dominantSalaryWindow,
        sampleSize: dominantSalaryEntries.length,
      },
      validFrom: dominantSalaryEntries[0]!.occurredAt,
      validTo: dominantSalaryEntries[dominantSalaryEntries.length - 1]!.occurredAt,
      createdAt: now,
    });
  }

  for (const category of expenseCategories) {
    const recentEntries = expensesForUser.filter(
      (entry) => entry.category === category && entry.occurredAt >= recentWindowStart,
    );
    const baselineEntries = expensesForUser.filter(
      (entry) =>
        entry.category === category &&
        entry.occurredAt >= baselineWindowStart &&
        entry.occurredAt < recentWindowStart,
    );

    if (recentEntries.length < 2 || baselineEntries.length < 2) {
      continue;
    }

    const currentAmountMinor = recentEntries.reduce((sum, entry) => sum + entry.amountMinor, 0);
    const baselineAmountMinor = Math.round(
      baselineEntries.reduce((sum, entry) => sum + entry.amountMinor, 0) / 2,
    );

    if (
      baselineAmountMinor > 0 &&
      currentAmountMinor >= baselineAmountMinor * 1.35 &&
      currentAmountMinor - baselineAmountMinor >= 40_000
    ) {
      facts.push({
        id: crypto.randomUUID(),
        userId,
        kind: "spend-shift",
        status: "active",
        title: `${formatCategory(category)} is running above baseline`,
        body: `Recent ${category} spend is at ${formatCurrency(currentAmountMinor)} versus a trailing baseline near ${formatCurrency(baselineAmountMinor)}. Finn should treat this as an active drift, not a one-off.`,
        confidence: 86,
        evidence: {
          expenseIds: recentEntries.slice(-5).map((entry) => entry.id),
          relatedNodeKeys: [`category:${category}`],
          category,
          sampleSize: recentEntries.length + baselineEntries.length,
          baselineAmountMinor,
          currentAmountMinor,
        },
        validFrom: recentEntries[0]!.occurredAt,
        validTo: recentEntries[recentEntries.length - 1]!.occurredAt,
        createdAt: now,
      });
    }
  }

  for (const [merchantKey, categoryCounts] of merchantCategoryCounts.entries()) {
    const rankedCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
    const dominant = rankedCategories[0];
    const mismatchCount = rankedCategories.slice(1).reduce((sum, [, count]) => sum + count, 0);
    const totalCount = rankedCategories.reduce((sum, [, count]) => sum + count, 0);

    if (!dominant || totalCount < 4 || mismatchCount === 0 || dominant[1] / totalCount < 0.65) {
      continue;
    }

    const merchantEntries = merchantGroups.get(merchantKey) ?? [];
    const mismatchEntries = merchantEntries.filter((entry) => entry.category !== dominant[0]).slice(-4);
    if (!mismatchEntries.length) {
      continue;
    }

    const merchantLabel = normalizeMerchantName(merchantEntries[0]!.merchantName).label;
    const factId = crypto.randomUUID();

    facts.push({
      id: factId,
      userId,
      kind: "merchant-category-mismatch",
      status: "active",
      title: `${merchantLabel} is drifting outside its usual category`,
      body: `${merchantLabel} is usually logged as ${formatCategory(dominant[0])}, but ${mismatchCount} entries landed elsewhere. Finn should watch for tagging noise or an actual behavior shift.`,
      confidence: 73,
      evidence: {
        expenseIds: mismatchEntries.map((entry) => entry.id),
        relatedNodeKeys: [`merchant:${merchantKey}`, `category:${dominant[0]}`],
        merchantName: merchantLabel,
        dominantCategory: dominant[0],
        mismatchCount,
        sampleSize: totalCount,
      },
      validFrom: merchantEntries[0]!.occurredAt,
      validTo: merchantEntries[merchantEntries.length - 1]!.occurredAt,
      createdAt: now,
    });

    for (const mismatchEntry of mismatchEntries) {
      observations.push({
        id: crypto.randomUUID(),
        userId,
        expenseId: mismatchEntry.id,
        memoryFactId: factId,
        metadata: {
          normalizedMerchantName: merchantKey,
          dominantCategory: dominant[0],
          categoryConsistent: false,
        },
        createdAt: mismatchEntry.occurredAt,
      });
    }
  }

  const edges: MemoryEdgeInsert[] = [...edgeAccumulators.values()].map((entry) => ({
    id: crypto.randomUUID(),
    userId,
    fromNodeId: entry.fromNodeId,
    toNodeId: entry.toNodeId,
    relation: entry.relation,
    weight: Math.max(1, Math.round((entry.supportCount / Math.max(expensesForUser.length, 1)) * 100)),
    metadata: {
      ...entry.metadata,
      supportCount: entry.supportCount,
      totalAmountMinor: entry.totalAmountMinor,
      averageAmountMinor: Math.round(entry.totalAmountMinor / Math.max(entry.supportCount, 1)),
      percentage:
        totalSpend > 0 ? Number(((entry.totalAmountMinor / totalSpend) * 100).toFixed(1)) : 0,
    },
    createdAt: now,
  }));

  return {
    nodes: [...nodes.values()],
    edges,
    facts: facts.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)),
    observations,
  };
}

export async function rebuildFinancialMemoryGraph(userId: string, expensesForUser: MemoryExpense[]) {
  await db.delete(memoryObservation).where(eq(memoryObservation.userId, userId));
  await db.delete(memoryEdge).where(eq(memoryEdge.userId, userId));
  await db.delete(memoryFact).where(eq(memoryFact.userId, userId));
  await db.delete(memoryNode).where(eq(memoryNode.userId, userId));

  if (!expensesForUser.length) {
    return;
  }

  const graph = buildFinancialMemoryGraph(userId, expensesForUser);

  if (graph.nodes.length) {
    await db.insert(memoryNode).values(graph.nodes);
  }

  if (graph.facts.length) {
    await db.insert(memoryFact).values(graph.facts);
  }

  if (graph.edges.length) {
    await db.insert(memoryEdge).values(graph.edges);
  }

  if (graph.observations.length) {
    await db.insert(memoryObservation).values(graph.observations);
  }
}

export async function listMemoryFactsForUser(userId: string, limit = 6) {
  return db
    .select()
    .from(memoryFact)
    .where(eq(memoryFact.userId, userId))
    .orderBy(desc(memoryFact.confidence), desc(memoryFact.createdAt))
    .limit(limit);
}

export async function listMemoryNodesForUser(userId: string, limit = 12) {
  return db
    .select()
    .from(memoryNode)
    .where(eq(memoryNode.userId, userId))
    .orderBy(desc(memoryNode.confidence), desc(memoryNode.updatedAt))
    .limit(limit);
}

export type FinancialMemoryFact = Awaited<ReturnType<typeof listMemoryFactsForUser>>[number];
export type FinancialMemoryNode = Awaited<ReturnType<typeof listMemoryNodesForUser>>[number];
