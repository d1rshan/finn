import {
  expenseCategories,
  type BehavioralPersona,
  type DayOfWeekSpend,
  type ExpenseCategory,
  type InsightSeverity,
  type InsightSummary,
  type RecurringCharge,
  type ReportMetadata,
  type ReportMetric,
  type ReportTopCategory,
  type ReportTopMerchant,
  type SilenceSignal,
  type SpendProjection,
} from "@finn/db";

type ExpenseLike = {
  id: string;
  amountMinor: number;
  merchantName: string;
  category: ExpenseCategory;
  occurredAt: Date;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  currency: string;
  userId: string;
};

type AnalyticsSnapshot = {
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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DISCRETIONARY_CATEGORIES = new Set<ExpenseCategory>([
  "food",
  "shopping",
  "entertainment",
  "travel",
  "other",
]);

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function sumExpenses(expenses: ExpenseLike[]) {
  return expenses.reduce((total, entry) => total + entry.amountMinor, 0);
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

function average(values: number[]) {
  return values.length ? sum(values) / values.length : 0;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function differenceInDays(later: Date, earlier: Date) {
  return Math.round((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / 86_400_000);
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

function groupDailySpend(expenses: ExpenseLike[]) {
  const totals = new Map<string, number>();

  for (const entry of expenses) {
    const key = startOfDay(entry.occurredAt).toISOString();
    totals.set(key, (totals.get(key) ?? 0) + entry.amountMinor);
  }

  return [...totals.entries()]
    .map(([key, amountMinor]) => ({
      day: new Date(key),
      amountMinor,
    }))
    .sort((a, b) => a.day.getTime() - b.day.getTime());
}

function linearRegressionSlope(points: number[]) {
  if (points.length < 2) {
    return 0;
  }

  const n = points.length;
  const xMean = (n - 1) / 2;
  const yMean = average(points);

  let numerator = 0;
  let denominator = 0;

  for (let index = 0; index < points.length; index += 1) {
    const x = index;
    const y = points[index] ?? 0;
    numerator += (x - xMean) * (y - yMean);
    denominator += (x - xMean) ** 2;
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

function buildDayOfWeekSpend(expenses: ExpenseLike[]): DayOfWeekSpend[] {
  return DAY_NAMES.map((day, index) => {
    const entries = expenses.filter((entry) => entry.occurredAt.getDay() === index);
    const amountMinor = sumExpenses(entries);
    const activeDays = new Set(entries.map((entry) => startOfDay(entry.occurredAt).toISOString())).size;

    return {
      day,
      amountMinor,
      averageAmountMinor: activeDays > 0 ? Math.round(amountMinor / activeDays) : 0,
      transactionCount: entries.length,
    };
  });
}

function buildTopCategories(expenses: ExpenseLike[]): ReportTopCategory[] {
  const total = sumExpenses(expenses);
  const categoryMap = new Map<ExpenseCategory, number>();

  for (const category of expenseCategories) {
    categoryMap.set(category, 0);
  }

  for (const entry of expenses) {
    categoryMap.set(entry.category, (categoryMap.get(entry.category) ?? 0) + entry.amountMinor);
  }

  return [...categoryMap.entries()]
    .filter(([, amountMinor]) => amountMinor > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amountMinor]) => ({
      category,
      amountMinor,
      percentage: total > 0 ? round((amountMinor / total) * 100) : 0,
    }));
}

function buildTopMerchants(expenses: ExpenseLike[]): ReportTopMerchant[] {
  const merchantMap = new Map<string, { amountMinor: number; count: number }>();

  for (const entry of expenses) {
    const current = merchantMap.get(entry.merchantName) ?? { amountMinor: 0, count: 0 };
    merchantMap.set(entry.merchantName, {
      amountMinor: current.amountMinor + entry.amountMinor,
      count: current.count + 1,
    });
  }

  return [...merchantMap.entries()]
    .sort((a, b) => b[1].amountMinor - a[1].amountMinor)
    .slice(0, 3)
    .map(([merchantName, value]) => ({
      merchantName,
      amountMinor: value.amountMinor,
      count: value.count,
    }));
}

function buildMetrics(expenses: ExpenseLike[], previousExpenses: ExpenseLike[]): ReportMetric[] {
  const total = sumExpenses(expenses);
  const previousTotal = sumExpenses(previousExpenses);

  return [
    {
      label: "Total spend",
      value: total,
      change:
        previousTotal > 0 ? round(((total - previousTotal) / previousTotal) * 100) : null,
    },
    {
      label: "Transactions",
      value: expenses.length,
      change:
        previousExpenses.length > 0
          ? round(((expenses.length - previousExpenses.length) / previousExpenses.length) * 100)
          : null,
    },
    {
      label: "Average payment",
      value: expenses.length ? Math.round(total / expenses.length) : 0,
      change:
        previousExpenses.length > 0
          ? round(
              (((expenses.length ? total / expenses.length : 0) -
                (previousExpenses.length
                  ? sumExpenses(previousExpenses) / previousExpenses.length
                  : 0)) /
                (sumExpenses(previousExpenses) / previousExpenses.length)) *
                100,
            )
          : null,
    },
  ];
}

function inferPersona(args: {
  expenses: ExpenseLike[];
  topCategories: ReportTopCategory[];
  dayOfWeekSpend: DayOfWeekSpend[];
}): BehavioralPersona | null {
  if (args.expenses.length < 4) {
    return null;
  }

  const weekendTotal = args.dayOfWeekSpend
    .filter((entry) => entry.day === "Sat" || entry.day === "Sun")
    .reduce((total, entry) => total + entry.amountMinor, 0);
  const weekdayTotal = args.dayOfWeekSpend
    .filter((entry) => entry.day !== "Sat" && entry.day !== "Sun")
    .reduce((total, entry) => total + entry.amountMinor, 0);

  const weekendShare = weekendTotal / Math.max(1, weekendTotal + weekdayTotal);
  const dailyAmounts = groupDailySpend(args.expenses).map((entry) => entry.amountMinor);
  const dailyAverage = average(dailyAmounts);
  const variance = average(dailyAmounts.map((value) => (value - dailyAverage) ** 2));
  const coefficientOfVariation = dailyAverage > 0 ? Math.sqrt(variance) / dailyAverage : 0;
  const topCategory = args.topCategories[0];

  const lateNightSpend = args.expenses
    .filter((entry) => entry.occurredAt.getHours() >= 21 || entry.occurredAt.getHours() < 2)
    .reduce((total, entry) => total + entry.amountMinor, 0);
  const lateNightShare = lateNightSpend / Math.max(1, sumExpenses(args.expenses));

  if (weekendShare >= 0.48) {
    return {
      label: "Weekend Warrior",
      summary: "Your spending loads up from Friday through Sunday, with weekends carrying most of the weight.",
    };
  }

  if (topCategory && topCategory.percentage >= 45) {
    return {
      label: "Category Splurger",
      summary: `One category is doing most of the work right now, with ${topCategory.category} dominating your spend mix.`,
    };
  }

  if (lateNightShare >= 0.28) {
    return {
      label: "Night Owl Spender",
      summary: "A large share of your spending lands late in the day, which usually points to reactive or convenience purchases.",
    };
  }

  if (coefficientOfVariation <= 0.6) {
    return {
      label: "Steady Eddy",
      summary: "Your daily spend is comparatively even, with fewer sharp spikes than most users.",
    };
  }

  return {
    label: "Flexible Planner",
    summary: "Your spending adapts week to week without fully locking into one rigid pattern.",
  };
}

function inferRecurringCharges(expenses: ExpenseLike[]): RecurringCharge[] {
  const grouped = new Map<string, ExpenseLike[]>();

  for (const entry of expenses) {
    const key = `${entry.merchantName}::${entry.category}`;
    const values = grouped.get(key) ?? [];
    values.push(entry);
    grouped.set(key, values);
  }

  return [...grouped.values()]
    .map((entries) => {
      const sorted = [...entries].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
      if (sorted.length < 3) {
        return null;
      }

      const gaps = sorted.slice(1).map((entry, index) => {
        const previous = sorted[index];
        return previous ? differenceInDays(entry.occurredAt, previous.occurredAt) : 0;
      });

      const cadenceDays = median(gaps);
      const amounts = sorted.map((entry) => entry.amountMinor);
      const amountMedian = median(amounts);
      const maxDeviation = Math.max(
        ...amounts.map((amountMinor) =>
          amountMedian > 0 ? Math.abs(amountMinor - amountMedian) / amountMedian : 0,
        ),
      );

      if (cadenceDays < 24 || cadenceDays > 35 || maxDeviation > 0.18) {
        return null;
      }

      const latest = sorted[sorted.length - 1];
      if (!latest) {
        return null;
      }

      return {
        merchantName: latest.merchantName,
        category: latest.category,
        amountMinor: amountMedian,
        cadenceDays,
        lastChargedAt: latest.occurredAt.toISOString(),
      } satisfies RecurringCharge;
    })
    .filter((entry): entry is RecurringCharge => Boolean(entry))
    .sort((a, b) => b.amountMinor - a.amountMinor)
    .slice(0, 4);
}

function inferUnusualSilence(expenses: ExpenseLike[], now: Date): SilenceSignal[] {
  return expenseCategories
    .map((category) => {
      const categoryExpenses = expenses
        .filter((entry) => entry.category === category)
        .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

      if (categoryExpenses.length < 4) {
        return null;
      }

      const gaps = categoryExpenses.slice(1).map((entry, index) => {
        const previous = categoryExpenses[index];
        return previous ? differenceInDays(entry.occurredAt, previous.occurredAt) : 0;
      });
      const expectedGapDays = Math.max(1, Math.round(average(gaps)));
      const latest = categoryExpenses[categoryExpenses.length - 1];
      if (!latest) {
        return null;
      }

      const actualGapDays = Math.max(0, differenceInDays(now, latest.occurredAt));
      if (actualGapDays < expectedGapDays * 1.8 || actualGapDays < expectedGapDays + 3) {
        return null;
      }

      return {
        category,
        expectedGapDays,
        actualGapDays,
      } satisfies SilenceSignal;
    })
    .filter((entry): entry is SilenceSignal => Boolean(entry))
    .sort((a, b) => b.actualGapDays - a.actualGapDays)
    .slice(0, 3);
}

function inferProjections(expenses: ExpenseLike[], now: Date): SpendProjection[] {
  const currentMonthStart = startOfMonth(now);
  const currentMonthExpenses = expenses.filter((entry) => entry.occurredAt >= currentMonthStart);
  if (currentMonthExpenses.length === 0) {
    return [];
  }

  const daysElapsed = Math.max(1, differenceInDays(now, currentMonthStart) + 1);
  const daysInMonth = differenceInDays(endOfMonth(now), currentMonthStart);

  return expenseCategories
    .map((category) => {
      const categoryExpenses = currentMonthExpenses.filter((entry) => entry.category === category);
      if (categoryExpenses.length === 0) {
        return null;
      }

      const currentTotal = sumExpenses(categoryExpenses);
      const dailySeries = Array.from({ length: daysElapsed }, (_, index) => {
        const currentDay = new Date(
          currentMonthStart.getFullYear(),
          currentMonthStart.getMonth(),
          currentMonthStart.getDate() + index,
        );
        return categoryExpenses
          .filter((entry) => startOfDay(entry.occurredAt).getTime() === currentDay.getTime())
          .reduce((total, entry) => total + entry.amountMinor, 0);
      });

      const slope = linearRegressionSlope(dailySeries);
      const averageDailySpend = currentTotal / daysElapsed;
      const remainingDays = Math.max(0, daysInMonth - daysElapsed);
      const projectedAmountMinor = Math.max(
        currentTotal,
        Math.round(currentTotal + averageDailySpend * remainingDays + slope * (remainingDays / 2)),
      );

      const monthlyHistory = [1, 2, 3]
        .map((offset) => {
          const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
          const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
          return sumExpenses(
            expenses.filter(
              (entry) =>
                entry.category === category &&
                entry.occurredAt >= start &&
                entry.occurredAt < end,
            ),
          );
        })
        .filter((amountMinor) => amountMinor > 0);

      const baselineAmountMinor = monthlyHistory.length
        ? Math.round(average(monthlyHistory))
        : currentTotal;

      return {
        category,
        projectedAmountMinor,
        baselineAmountMinor,
        deltaMinor: projectedAmountMinor - baselineAmountMinor,
      } satisfies SpendProjection;
    })
    .filter((entry): entry is SpendProjection => Boolean(entry))
    .sort((a, b) => Math.abs(b.deltaMinor) - Math.abs(a.deltaMinor))
    .slice(0, 4);
}

function inferEmotionalFingerprint(expenses: ExpenseLike[]) {
  const discretionary = expenses.filter((entry) => DISCRETIONARY_CATEGORIES.has(entry.category));
  if (discretionary.length < 3) {
    return undefined;
  }

  const grouped = new Map<string, { count: number; categories: ExpenseCategory[] }>();

  for (const entry of discretionary) {
    const day = DAY_NAMES[entry.occurredAt.getDay()] ?? "Unknown";
    const hour = entry.occurredAt.getHours();
    const part =
      hour < 6 ? "late night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    const key = `${day} ${part}`;
    const current = grouped.get(key) ?? { count: 0, categories: [] };
    current.count += 1;
    current.categories.push(entry.category);
    grouped.set(key, current);
  }

  const topCluster = [...grouped.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  if (!topCluster || topCluster[1].count < 2) {
    return undefined;
  }

  const leadingCategory = [...topCluster[1].categories].sort(
    (a, b) =>
      topCluster[1].categories.filter((entry) => entry === b).length -
      topCluster[1].categories.filter((entry) => entry === a).length,
  )[0];

  return `You tend to lean into ${leadingCategory ?? "discretionary"} spending on ${topCluster[0]}.`;
}

function inferEndOfMonthCrunch(expenses: ExpenseLike[]) {
  const monthKeys = [...new Set(expenses.map((entry) => `${entry.occurredAt.getFullYear()}-${entry.occurredAt.getMonth()}`))];
  const ratios = monthKeys
    .map((key) => {
      const [yearString, monthString] = key.split("-");
      const year = Number(yearString);
      const month = Number(monthString);
      const monthExpenses = expenses.filter(
        (entry) => entry.occurredAt.getFullYear() === year && entry.occurredAt.getMonth() === month,
      );
      const firstWindow = monthExpenses.filter((entry) => entry.occurredAt.getDate() <= 21);
      const lastWindow = monthExpenses.filter((entry) => entry.occurredAt.getDate() > 21);
      if (firstWindow.length < 2 || lastWindow.length < 1) {
        return null;
      }

      const firstDaily = sumExpenses(firstWindow) / 21;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const lastDaily = sumExpenses(lastWindow) / Math.max(1, daysInMonth - 21);
      return firstDaily > 0 ? lastDaily / firstDaily : null;
    })
    .filter((value): value is number => value !== null);

  if (ratios.length < 2) {
    return undefined;
  }

  const averageRatio = average(ratios);
  if (averageRatio >= 0.8) {
    return undefined;
  }

  return `You typically throttle spending near month-end, dropping to about ${Math.round(
    averageRatio * 100,
  )}% of your early-month pace.`;
}

function inferGuiltIndex(expenses: ExpenseLike[]) {
  const discretionary = expenses
    .filter((entry) => DISCRETIONARY_CATEGORIES.has(entry.category))
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  if (discretionary.length < 5) {
    return null;
  }

  const discretionaryAmounts = discretionary.map((entry) => entry.amountMinor);
  const discretionaryMedian = median(discretionaryAmounts);
  const dailySpend = groupDailySpend(expenses);
  const dailyMap = new Map(dailySpend.map((entry) => [startOfDay(entry.day).toISOString(), entry.amountMinor]));

  let loops = 0;

  for (const entry of discretionary) {
    if (entry.amountMinor < discretionaryMedian * 1.8) {
      continue;
    }

    const beforeWindow = dailySpend
      .filter(
        (point) =>
          point.day < startOfDay(entry.occurredAt) &&
          point.day >= startOfDay(subtractDays(entry.occurredAt, 14)),
      )
      .map((point) => point.amountMinor);
    const afterWindow = [1, 2, 3].map((offset) => {
      const day = startOfDay(subtractDays(entry.occurredAt, -offset)).toISOString();
      return dailyMap.get(day) ?? 0;
    });

    if (beforeWindow.length < 4) {
      continue;
    }

    if (average(afterWindow) <= average(beforeWindow) * 0.55) {
      loops += 1;
    }
  }

  if (loops === 0) {
    return null;
  }

  const score = Math.min(100, loops * 25);
  return {
    score,
    summary: `You tend to pull back for a few days after a big discretionary payment, which suggests an over-correction loop.`,
  };
}

function buildBehavioralSignals(args: {
  expenses: ExpenseLike[];
  previousExpenses: ExpenseLike[];
  topCategories: ReportTopCategory[];
  topMerchants: ReportTopMerchant[];
  dayOfWeekSpend: DayOfWeekSpend[];
  persona: BehavioralPersona | null;
  projections: SpendProjection[];
  recurringCharges: RecurringCharge[];
  unusualSilence: SilenceSignal[];
  emotionalSpendingFingerprint?: string;
  endOfMonthCrunch?: string;
  guiltIndex?: { score: number; summary: string } | null;
  now: Date;
}): InsightSummary[] {
  const signals: InsightSummary[] = [];
  const currentTotal = sumExpenses(args.expenses);
  const previousTotal = sumExpenses(args.previousExpenses);

  if (previousTotal > 0 && currentTotal >= previousTotal * 1.25) {
    signals.push({
      key: "weekly-spike",
      title: "Spending velocity picked up",
      summary: `This period is running ${round(((currentTotal - previousTotal) / previousTotal) * 100)}% above the prior comparison window.`,
      severity: currentTotal >= previousTotal * 1.5 ? "high" : "medium",
    });
  }

  const strongestDay = [...args.dayOfWeekSpend].sort(
    (a, b) => b.averageAmountMinor - a.averageAmountMinor,
  )[0];
  if (strongestDay && strongestDay.averageAmountMinor > 0) {
    signals.push({
      key: "day-rhythm",
      title: `${strongestDay.day} is your spend-heavy day`,
      summary: `Your average ${strongestDay.day} spending is the highest in the week rhythm.`,
      severity: "low",
    });
  }

  const topProjection = args.projections.find((entry) => entry.deltaMinor > 0);
  if (topProjection && topProjection.deltaMinor >= 20_000) {
    signals.push({
      key: "projection",
      title: `${topProjection.category} is on pace to overshoot`,
      summary: `At the current rate, ${topProjection.category} could finish ${Math.abs(topProjection.deltaMinor) / 100 >= 100 ? "well" : "slightly"} above its recent baseline this month.`,
      severity: topProjection.deltaMinor >= 50_000 ? "high" : "medium",
    });
  }

  const leadingRecurring = args.recurringCharges[0];
  if (leadingRecurring) {
    signals.push({
      key: "recurring",
      title: `${leadingRecurring.merchantName} looks recurring`,
      summary: `A similar charge has been appearing roughly every ${leadingRecurring.cadenceDays} days.`,
      severity: "medium",
    });
  }

  const silence = args.unusualSilence[0];
  if (silence) {
    signals.push({
      key: "silence",
      title: `${silence.category} has gone quiet`,
      summary: `You usually spend here every ${silence.expectedGapDays} days, but it has been ${silence.actualGapDays} days.`,
      severity: "low",
    });
  }

  const topCategory = args.topCategories[0];
  if (topCategory && topCategory.percentage >= 40) {
    signals.push({
      key: "category-concentration",
      title: `${topCategory.category} is dominating your mix`,
      summary: `${topCategory.category} now accounts for ${topCategory.percentage}% of tracked spend.`,
      severity: topCategory.percentage >= 55 ? "high" : "medium",
    });
  }

  if (args.endOfMonthCrunch) {
    signals.push({
      key: "month-end-crunch",
      title: "You tighten up near month-end",
      summary: args.endOfMonthCrunch,
      severity: "low",
    });
  }

  if (args.emotionalSpendingFingerprint) {
    signals.push({
      key: "emotional-fingerprint",
      title: "A behavioral fingerprint is emerging",
      summary: args.emotionalSpendingFingerprint,
      severity: "low",
    });
  }

  if (args.guiltIndex) {
    signals.push({
      key: "guilt-index",
      title: "Post-spend cooling-off pattern detected",
      summary: args.guiltIndex.summary,
      severity: args.guiltIndex.score >= 60 ? "medium" : "low",
    });
  }

  if (args.persona) {
    signals.push({
      key: "persona",
      title: args.persona.label,
      summary: args.persona.summary,
      severity: "low",
    });
  }

  return signals.slice(0, 8);
}

export function buildAnalyticsSnapshot(args: {
  expenses: ExpenseLike[];
  previousExpenses: ExpenseLike[];
  now?: Date;
}): AnalyticsSnapshot {
  const now = args.now ?? new Date();
  const topCategories = buildTopCategories(args.expenses);
  const topMerchants = buildTopMerchants(args.expenses);
  const dayOfWeekSpend = buildDayOfWeekSpend(args.expenses);
  const projections = inferProjections(args.expenses, now);
  const recurringCharges = inferRecurringCharges(args.expenses);
  const unusualSilence = inferUnusualSilence(args.expenses, now);
  const emotionalSpendingFingerprint = inferEmotionalFingerprint(args.expenses);
  const endOfMonthCrunch = inferEndOfMonthCrunch(args.expenses);
  const guiltIndex = inferGuiltIndex(args.expenses);
  const persona = inferPersona({
    expenses: args.expenses,
    topCategories,
    dayOfWeekSpend,
  });

  return {
    metrics: buildMetrics(args.expenses, args.previousExpenses),
    topCategories,
    topMerchants,
    transactionCount: args.expenses.length,
    persona,
    behavioralSignals: buildBehavioralSignals({
      expenses: args.expenses,
      previousExpenses: args.previousExpenses,
      topCategories,
      topMerchants,
      dayOfWeekSpend,
      persona,
      projections,
      recurringCharges,
      unusualSilence,
      emotionalSpendingFingerprint,
      endOfMonthCrunch,
      guiltIndex,
      now,
    }),
    dayOfWeekSpend,
    projections,
    recurringCharges,
    unusualSilence,
    emotionalSpendingFingerprint,
    endOfMonthCrunch,
    guiltIndex,
  };
}

function topBlindSpot(snapshot: AnalyticsSnapshot) {
  return [...snapshot.behavioralSignals].sort((a, b) => {
    const score = { low: 1, medium: 2, high: 3 } satisfies Record<InsightSeverity, number>;
    return score[b.severity] - score[a.severity];
  })[0];
}

function buildSpendDeltaExplanation(currentExpenses: ExpenseLike[], previousExpenses: ExpenseLike[]) {
  const currentTotal = sumExpenses(currentExpenses);
  const previousTotal = sumExpenses(previousExpenses);
  const delta = currentTotal - previousTotal;
  const categoryMap = new Map<ExpenseCategory, number>();

  for (const category of expenseCategories) {
    const current = sumExpenses(currentExpenses.filter((entry) => entry.category === category));
    const previous = sumExpenses(previousExpenses.filter((entry) => entry.category === category));
    categoryMap.set(category, current - previous);
  }

  const topDriver = [...categoryMap.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    currentTotal,
    previousTotal,
    delta,
    topDriver,
  };
}

function parseMoneyTarget(question: string) {
  const match = question.match(/(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i);
  if (!match?.[1]) {
    return null;
  }

  const numeric = Number(match[1].replaceAll(",", ""));
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : null;
}

export function answerMoneyQuestion(args: {
  question: string;
  currentExpenses: ExpenseLike[];
  previousExpenses: ExpenseLike[];
  snapshot: AnalyticsSnapshot;
}): {
  answer: string;
  suggestions: string[];
  supportingSignals: InsightSummary[];
} {
  const question = args.question.trim();
  const normalized = question.toLowerCase();
  const topProjection = args.snapshot.projections[0];
  const blindSpot = topBlindSpot(args.snapshot);

  if (normalized.includes("why") && normalized.includes("last week")) {
    const spendDelta = buildSpendDeltaExplanation(args.currentExpenses, args.previousExpenses);
    const topDriver = spendDelta.topDriver;
    const percentage =
      spendDelta.previousTotal > 0
        ? round((spendDelta.delta / spendDelta.previousTotal) * 100)
        : null;

    return {
      answer: percentage !== null
        ? `Last week ran ${percentage}% above the week before. The biggest driver was ${topDriver?.[0] ?? "overall volume"}, and ${args.snapshot.behavioralSignals[0]?.summary.toLowerCase() ?? "your transaction pace was simply higher than usual"}.`
        : `You spent more last week because overall transaction volume picked up, but I do not have a stable prior week baseline yet.`,
      suggestions: [
        "What is my biggest financial blind spot?",
        "Which subscriptions look recurring?",
        "What category is drifting upward?",
      ],
      supportingSignals: args.snapshot.behavioralSignals.slice(0, 3),
    };
  }

  if (
    normalized.includes("track") ||
    normalized.includes("projection") ||
    normalized.includes("save")
  ) {
    const target = parseMoneyTarget(question);
    const totalProjectedSpend = sum(args.snapshot.projections.map((entry) => entry.projectedAmountMinor));
    const answerParts = [];

    if (topProjection) {
      answerParts.push(
        `${topProjection.category} is your clearest month-end watchpoint, currently projecting around ₹${Math.round(
          topProjection.projectedAmountMinor / 100,
        ).toLocaleString("en-IN")}.`,
      );
    }

    if (target) {
      answerParts.push(
        `I can estimate spending trajectory, but I cannot verify a savings target like ₹${Math.round(
          target / 100,
        ).toLocaleString("en-IN")} without income or balance data. Your tracked categories are currently pacing toward roughly ₹${Math.round(
          totalProjectedSpend / 100,
        ).toLocaleString("en-IN")} in month-end spend.`,
      );
    } else {
      answerParts.push(
        `Across active categories, your current trajectory points to roughly ₹${Math.round(
          totalProjectedSpend / 100,
        ).toLocaleString("en-IN")} by month-end.`,
      );
    }

    return {
      answer: answerParts.join(" "),
      suggestions: [
        "Which category is likely to overshoot?",
        "Why did I spend more last week?",
        "Do I have any forgotten subscriptions?",
      ],
      supportingSignals: args.snapshot.behavioralSignals.filter((entry) =>
        ["projection", "month-end-crunch", "persona"].includes(entry.key),
      ),
    };
  }

  if (normalized.includes("blind spot") || normalized.includes("biggest risk")) {
    return {
      answer: blindSpot
        ? `Your biggest blind spot right now is ${blindSpot.title.toLowerCase()}. ${blindSpot.summary}`
        : "I do not see a strong blind spot yet. Your current spending pattern is still too sparse to call out one dominant risk.",
      suggestions: [
        "Why did I spend more last week?",
        "What behavior pattern am I showing?",
        "Which category has gone quiet?",
      ],
      supportingSignals: blindSpot ? [blindSpot] : [],
    };
  }

  if (normalized.includes("subscription") || normalized.includes("recurring")) {
    const recurring = args.snapshot.recurringCharges;
    return {
      answer: recurring.length
        ? `I found ${recurring.length} recurring-looking charge${recurring.length === 1 ? "" : "s"}. The strongest candidate is ${recurring[0]?.merchantName}, recurring about every ${recurring[0]?.cadenceDays} days.`
        : "I do not yet see a strong recurring-charge pattern. I need at least a few similarly timed payments to infer one reliably.",
      suggestions: [
        "What is my biggest financial blind spot?",
        "What category is drifting upward?",
        "Why did I spend more last week?",
      ],
      supportingSignals: args.snapshot.behavioralSignals.filter((entry) =>
        ["recurring", "silence"].includes(entry.key),
      ),
    };
  }

  if (normalized.includes("persona") || normalized.includes("pattern") || normalized.includes("behavior")) {
    return {
      answer: args.snapshot.persona
        ? `You currently read as ${args.snapshot.persona.label}. ${args.snapshot.persona.summary}${args.snapshot.emotionalSpendingFingerprint ? ` ${args.snapshot.emotionalSpendingFingerprint}` : ""}`
        : "I can see some activity, but not enough consistency yet to assign a stable spending persona.",
      suggestions: [
        "What is my biggest financial blind spot?",
        "Why did I spend more last week?",
        "Do I tighten spending near month-end?",
      ],
      supportingSignals: args.snapshot.behavioralSignals.filter((entry) =>
        ["persona", "day-rhythm", "emotional-fingerprint"].includes(entry.key),
      ),
    };
  }

  return {
    answer: blindSpot
      ? `Here is the clearest read: ${blindSpot.title}. ${blindSpot.summary}${topProjection ? ` I am also watching ${topProjection.category}, which is pacing above its recent baseline.` : ""}`
      : "I have your recent transactions, but I need a bit more history to produce a confident read. Keep logging and I’ll start surfacing sharper patterns.",
    suggestions: [
      "Why did I spend more last week?",
      "What is my biggest financial blind spot?",
      "Do I have any recurring charges?",
    ],
    supportingSignals: args.snapshot.behavioralSignals.slice(0, 3),
  };
}

export function buildReportMetadataFromSnapshot(snapshot: AnalyticsSnapshot): ReportMetadata {
  return {
    metrics: snapshot.metrics,
    topCategories: snapshot.topCategories,
    topMerchants: snapshot.topMerchants,
    transactionCount: snapshot.transactionCount,
    persona: snapshot.persona,
    behavioralSignals: snapshot.behavioralSignals,
    dayOfWeekSpend: snapshot.dayOfWeekSpend,
    projections: snapshot.projections,
    recurringCharges: snapshot.recurringCharges,
    unusualSilence: snapshot.unusualSilence,
    emotionalSpendingFingerprint: snapshot.emotionalSpendingFingerprint,
    endOfMonthCrunch: snapshot.endOfMonthCrunch,
    guiltIndex: snapshot.guiltIndex ?? null,
  };
}
