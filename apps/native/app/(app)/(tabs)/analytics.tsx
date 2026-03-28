import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Container } from "@/components/container";
import {
  formatAnalyticsCategory,
  formatCurrency,
  formatDate,
  formatMemoryFactKind,
} from "@/lib/format";
import { useAnalyticsQuery } from "@/lib/finn-api";
import type {
  AnalyticsCategorySummary,
  AnalyticsPeriodType,
  ExpenseCategory,
  FinancialMemoryFact,
} from "@/lib/finn-types";

const CATEGORY_COLORS: Record<ExpenseCategory | "all", string> = {
  all: "#f4f4f4",
  food: "#d4d4d4",
  commute: "#b6b6b6",
  groceries: "#9a9a9a",
  shopping: "#808080",
  bills: "#6a6a6a",
  entertainment: "#545454",
  health: "#c9c9c9",
  travel: "#f0f0f0",
  transfer: "#3f3f3f",
  other: "#707070",
};

const PERIOD_OPTIONS: AnalyticsPeriodType[] = ["daily", "weekly", "monthly"];

function periodLabel(period: AnalyticsPeriodType) {
  return period.charAt(0).toUpperCase() + period.slice(1);
}

function BucketBar({
  amountMinor,
  maxAmountMinor,
  isSelected,
  color,
  label,
  onPress,
}: {
  amountMinor: number;
  maxAmountMinor: number;
  isSelected: boolean;
  color: string;
  label: string;
  onPress: () => void;
}) {
  const height = Math.max(10, Math.round((amountMinor / Math.max(maxAmountMinor, 1)) * 128));

  return (
    <Pressable style={styles.barItem} onPress={onPress}>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              height,
              backgroundColor: isSelected ? color : "#242424",
            },
          ]}
        />
      </View>
      <Text style={[styles.barLabel, isSelected ? styles.barLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

function CategoryCard({
  item,
  selected,
  onPress,
}: {
  item: AnalyticsCategorySummary;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.categoryCard, selected ? styles.categoryCardSelected : null]}
    >
      <View style={styles.categoryCardHeader}>
        <Text style={styles.categoryCardTitle}>{formatAnalyticsCategory(item.category)}</Text>
        <Text style={styles.categoryCardShare}>{item.share}%</Text>
      </View>
      <Text style={styles.categoryCardValue}>{formatCurrency(item.totalSpend)}</Text>
      <Text style={styles.categoryCardMeta}>
        {item.transactionCount} payments · Avg {formatCurrency(item.averagePayment)}
      </Text>
    </Pressable>
  );
}

function MemoryFactCard({ item }: { item: FinancialMemoryFact }) {
  return (
    <View style={styles.memoryCard}>
      <View style={styles.memoryMeta}>
        <Text style={styles.memoryKind}>{formatMemoryFactKind(item.kind)}</Text>
        <Text style={styles.memoryConfidence}>{item.confidence}%</Text>
      </View>
      <Text style={styles.memoryTitle}>{item.title}</Text>
      <Text style={styles.memoryBody}>{item.body}</Text>
    </View>
  );
}

export default function AnalyticsScreen() {
  const [period, setPeriod] = useState<AnalyticsPeriodType>("weekly");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | "all">("all");
  const analyticsQuery = useAnalyticsQuery(period);

  const periods = analyticsQuery.data?.periods ?? [];
  const overview = analyticsQuery.data?.overview;
  const categories = analyticsQuery.data?.categories ?? [];
  const topMerchants = analyticsQuery.data?.topMerchants ?? [];
  const memoryFacts = analyticsQuery.data?.memory.facts ?? [];

  const filteredPeriods = useMemo(() => {
    if (selectedCategory === "all") {
      return periods;
    }

    return periods.filter((entry) => entry.categoryTotals[selectedCategory].amountMinor > 0);
  }, [periods, selectedCategory]);

  useEffect(() => {
    const preferredId = analyticsQuery.data?.selectedPeriodId;

    if (!filteredPeriods.length) {
      setSelectedPeriodId(null);
      return;
    }

    if (preferredId && filteredPeriods.some((entry) => entry.id === preferredId)) {
      setSelectedPeriodId(preferredId);
      return;
    }

    if (!selectedPeriodId || !filteredPeriods.some((entry) => entry.id === selectedPeriodId)) {
      setSelectedPeriodId(filteredPeriods[filteredPeriods.length - 1]?.id ?? null);
    }
  }, [analyticsQuery.data?.selectedPeriodId, filteredPeriods, selectedPeriodId]);

  const selectedIndex = filteredPeriods.findIndex((entry) => entry.id === selectedPeriodId);
  const selectedBucket = filteredPeriods[selectedIndex] ?? filteredPeriods[filteredPeriods.length - 1] ?? null;
  const previousBucket = selectedIndex > 0 ? filteredPeriods[selectedIndex - 1] : null;

  const selectedBucketMetrics = useMemo(() => {
    if (!selectedBucket) {
      return null;
    }

    if (selectedCategory === "all") {
      return {
        totalSpend: selectedBucket.totalSpend,
        transactionCount: selectedBucket.transactionCount,
        averagePayment: selectedBucket.averagePayment,
        dailyAverage: selectedBucket.dailyAverage,
      };
    }

    const categoryTotals = selectedBucket.categoryTotals[selectedCategory];
    const start = new Date(selectedBucket.periodStart);
    const end = new Date(selectedBucket.periodEnd);
    const spanDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));

    return {
      totalSpend: categoryTotals.amountMinor,
      transactionCount: categoryTotals.transactionCount,
      averagePayment:
        categoryTotals.transactionCount > 0
          ? Math.round(categoryTotals.amountMinor / categoryTotals.transactionCount)
          : 0,
      dailyAverage: Math.round(categoryTotals.amountMinor / spanDays),
    };
  }, [selectedBucket, selectedCategory]);

  const previousAmount = useMemo(() => {
    if (!previousBucket) {
      return null;
    }

    return selectedCategory === "all"
      ? previousBucket.totalSpend
      : previousBucket.categoryTotals[selectedCategory].amountMinor;
  }, [previousBucket, selectedCategory]);

  const selectedAmount = selectedBucketMetrics?.totalSpend ?? 0;
  const changePercentage =
    previousAmount && previousAmount > 0 ? ((selectedAmount - previousAmount) / previousAmount) * 100 : null;
  const maxSpend = Math.max(
    ...filteredPeriods.map((entry) =>
      selectedCategory === "all" ? entry.totalSpend : entry.categoryTotals[selectedCategory].amountMinor,
    ),
    1,
  );
  const timelineRows = [...filteredPeriods].reverse();

  return (
    <Container>
      <ScrollView
        refreshControl={
          <RefreshControl
            tintColor="#f4f4f4"
            refreshing={analyticsQuery.isRefetching}
            onRefresh={() => void analyticsQuery.refetch()}
          />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ANALYTICS</Text>
          <Text style={styles.title}>Everything Finn has seen, arranged into one readable surface.</Text>
          <Text style={styles.subtitle}>
            Switch between daily, weekly, and monthly history, then narrow the view by category without losing the full context.
          </Text>
        </View>

        {overview ? (
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>All-time overview</Text>
            <Text style={styles.heroValue}>{formatCurrency(overview.totalSpend)}</Text>
            <Text style={styles.heroBody}>
              {overview.transactionCount} payments since{" "}
              {overview.firstExpenseAt ? formatDate(overview.firstExpenseAt) : "the start"}.
            </Text>
            <View style={styles.metricGrid}>
              <View style={styles.metricTile}>
                <Text style={styles.metricLabel}>Average payment</Text>
                <Text style={styles.metricValue}>{formatCurrency(overview.averagePayment)}</Text>
              </View>
              <View style={styles.metricTile}>
                <Text style={styles.metricLabel}>Active days</Text>
                <Text style={styles.metricValue}>{overview.activeDays}</Text>
              </View>
              <View style={styles.metricTile}>
                <Text style={styles.metricLabel}>Active months</Text>
                <Text style={styles.metricValue}>{overview.activeMonths}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.controlSection}>
          <View style={styles.segmentedRow}>
            {PERIOD_OPTIONS.map((entry) => (
              <Pressable
                key={entry}
                onPress={() => setPeriod(entry)}
                style={[styles.segmentButton, period === entry ? styles.segmentButtonActive : null]}
              >
                <Text style={[styles.segmentText, period === entry ? styles.segmentTextActive : null]}>
                  {periodLabel(entry)}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <Pressable
              onPress={() => setSelectedCategory("all")}
              style={[
                styles.filterChip,
                selectedCategory === "all"
                  ? { backgroundColor: "#f4f4f4", borderColor: "#f4f4f4" }
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCategory === "all" ? styles.filterChipTextActive : null,
                ]}
              >
                All categories
              </Text>
            </Pressable>
            {categories.map((entry) => (
              <Pressable
                key={entry.category}
                onPress={() => setSelectedCategory(entry.category)}
                style={[
                  styles.filterChip,
                  selectedCategory === entry.category
                    ? {
                        borderColor: CATEGORY_COLORS[entry.category],
                        backgroundColor: "#111111",
                      }
                    : null,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedCategory === entry.category ? { color: "#f4f4f4" } : null,
                  ]}
                >
                  {formatAnalyticsCategory(entry.category)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {selectedBucket && selectedBucketMetrics ? (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>History</Text>
                <Text style={styles.sectionMeta}>{filteredPeriods.length} periods</Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartRow}>
                {filteredPeriods.map((entry) => {
                  const amountMinor =
                    selectedCategory === "all"
                      ? entry.totalSpend
                      : entry.categoryTotals[selectedCategory].amountMinor;

                  return (
                    <BucketBar
                      key={entry.id}
                      amountMinor={amountMinor}
                      maxAmountMinor={maxSpend}
                      isSelected={entry.id === selectedBucket.id}
                      color={CATEGORY_COLORS[selectedCategory]}
                      label={entry.label}
                      onPress={() => setSelectedPeriodId(entry.id)}
                    />
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.focusCard}>
              <Text style={styles.focusEyebrow}>
                {selectedCategory === "all"
                  ? selectedBucket.rangeLabel
                  : `${formatAnalyticsCategory(selectedCategory)} · ${selectedBucket.rangeLabel}`}
              </Text>
              <Text style={styles.focusValue}>{formatCurrency(selectedBucketMetrics.totalSpend)}</Text>
              {changePercentage !== null ? (
                <Text style={[styles.focusChange, changePercentage >= 0 ? styles.changeUp : styles.changeDown]}>
                  {Math.abs(changePercentage).toFixed(1)}% vs previous {period}
                </Text>
              ) : (
                <Text style={styles.focusHint}>No previous comparable period yet.</Text>
              )}

              <View style={styles.metricGrid}>
                <View style={styles.metricTile}>
                  <Text style={styles.metricLabel}>Payments</Text>
                  <Text style={styles.metricValue}>{selectedBucketMetrics.transactionCount}</Text>
                </View>
                <View style={styles.metricTile}>
                  <Text style={styles.metricLabel}>Average payment</Text>
                  <Text style={styles.metricValue}>{formatCurrency(selectedBucketMetrics.averagePayment)}</Text>
                </View>
                <View style={styles.metricTile}>
                  <Text style={styles.metricLabel}>Per day</Text>
                  <Text style={styles.metricValue}>{formatCurrency(selectedBucketMetrics.dailyAverage)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Category intelligence</Text>
                <Text style={styles.sectionMeta}>All-time</Text>
              </View>

              <View style={styles.categoryGrid}>
                {categories.map((entry) => (
                  <CategoryCard
                    key={entry.category}
                    item={entry}
                    selected={selectedCategory === entry.category}
                    onPress={() => setSelectedCategory(entry.category)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Top merchants</Text>
                <Text style={styles.sectionMeta}>Overall</Text>
              </View>

              <View style={styles.listCard}>
                {topMerchants.map((entry, index) => (
                  <View
                    key={`${entry.merchantName}-${index}`}
                    style={[styles.listRow, index === topMerchants.length - 1 ? styles.listRowLast : null]}
                  >
                    <View style={styles.listCopy}>
                      <Text style={styles.listTitle}>{entry.merchantName}</Text>
                      <Text style={styles.listMeta}>
                        {entry.count} payments · Last seen {formatDate(entry.lastOccurredAt)}
                      </Text>
                    </View>
                    <Text style={styles.listValue}>{formatCurrency(entry.amountMinor)}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Timeline</Text>
                <Text style={styles.sectionMeta}>From the start</Text>
              </View>

              <View style={styles.listCard}>
                {timelineRows.map((entry, index) => {
                  const amountMinor =
                    selectedCategory === "all"
                      ? entry.totalSpend
                      : entry.categoryTotals[selectedCategory].amountMinor;
                  const transactionCount =
                    selectedCategory === "all"
                      ? entry.transactionCount
                      : entry.categoryTotals[selectedCategory].transactionCount;

                  return (
                    <Pressable
                      key={entry.id}
                      onPress={() => setSelectedPeriodId(entry.id)}
                      style={[
                        styles.listRow,
                        entry.id === selectedBucket.id ? styles.listRowActive : null,
                        index === timelineRows.length - 1 ? styles.listRowLast : null,
                      ]}
                    >
                      <View style={styles.listCopy}>
                        <Text style={styles.listTitle}>{entry.rangeLabel}</Text>
                        <Text style={styles.listMeta}>{transactionCount} payments</Text>
                      </View>
                      <Text style={styles.listValue}>{formatCurrency(amountMinor)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {memoryFacts.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Learned patterns</Text>
                  <Text style={styles.sectionMeta}>Memory graph</Text>
                </View>

                <View style={styles.memoryStack}>
                  {memoryFacts.slice(0, 2).map((entry) => (
                    <MemoryFactCard key={entry.id} item={entry} />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="pie-chart-outline" size={48} color="#222" />
            <Text style={styles.emptyTitle}>No analytics yet</Text>
            <Text style={styles.emptyText}>Log a few transactions and Finn will build a readable history here.</Text>
          </View>
        )}
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
    gap: 18,
  },
  header: {
    gap: 10,
  },
  eyebrow: {
    color: "#777777",
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: "uppercase",
  },
  title: {
    color: "#f7f7f7",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "600",
  },
  subtitle: {
    color: "#868686",
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 340,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    backgroundColor: "#0a0a0a",
    padding: 20,
    gap: 10,
  },
  heroEyebrow: {
    color: "#7b7b7b",
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  heroValue: {
    color: "#f5f5f5",
    fontSize: 40,
    fontWeight: "600",
  },
  heroBody: {
    color: "#909090",
    fontSize: 14,
    lineHeight: 21,
  },
  metricGrid: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  metricTile: {
    flexGrow: 1,
    minWidth: 96,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#171717",
    backgroundColor: "#070707",
    padding: 14,
    gap: 6,
  },
  metricLabel: {
    color: "#6f6f6f",
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  metricValue: {
    color: "#f2f2f2",
    fontSize: 16,
    fontWeight: "600",
  },
  controlSection: {
    gap: 12,
  },
  segmentedRow: {
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#171717",
    backgroundColor: "#0b0b0b",
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    paddingVertical: 12,
  },
  segmentButtonActive: {
    backgroundColor: "#f4f4f4",
  },
  segmentText: {
    color: "#8b8b8b",
    fontSize: 14,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#050505",
  },
  filterRow: {
    gap: 10,
    paddingRight: 6,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    backgroundColor: "#0b0b0b",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  filterChipText: {
    color: "#9a9a9a",
    fontSize: 13,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#050505",
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: "#f4f4f4",
    fontSize: 18,
    fontWeight: "600",
  },
  sectionMeta: {
    color: "#727272",
    fontSize: 12,
  },
  chartRow: {
    gap: 10,
    paddingRight: 8,
  },
  barItem: {
    width: 26,
    alignItems: "center",
    gap: 8,
  },
  barTrack: {
    height: 132,
    width: 18,
    borderRadius: 10,
    backgroundColor: "#101010",
    justifyContent: "flex-end",
    overflow: "hidden",
    padding: 2,
  },
  barFill: {
    width: "100%",
    borderRadius: 8,
  },
  barLabel: {
    color: "#666666",
    fontSize: 10,
    textAlign: "center",
  },
  barLabelActive: {
    color: "#f4f4f4",
    fontWeight: "700",
  },
  focusCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    backgroundColor: "#0a0a0a",
    padding: 20,
    gap: 10,
  },
  focusEyebrow: {
    color: "#7d7d7d",
    fontSize: 11,
    letterSpacing: 1.7,
    textTransform: "uppercase",
  },
  focusValue: {
    color: "#f5f5f5",
    fontSize: 34,
    fontWeight: "600",
  },
  focusChange: {
    fontSize: 13,
    fontWeight: "600",
  },
  changeUp: {
    color: "#e17d7d",
  },
  changeDown: {
    color: "#8ad1b0",
  },
  focusHint: {
    color: "#7d7d7d",
    fontSize: 13,
  },
  categoryGrid: {
    gap: 10,
  },
  categoryCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    backgroundColor: "#090909",
    padding: 16,
    gap: 6,
  },
  categoryCardSelected: {
    borderColor: "#343434",
    backgroundColor: "#101010",
  },
  categoryCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  categoryCardTitle: {
    color: "#f4f4f4",
    fontSize: 15,
    fontWeight: "600",
  },
  categoryCardShare: {
    color: "#7d7d7d",
    fontSize: 12,
  },
  categoryCardValue: {
    color: "#f2f2f2",
    fontSize: 21,
    fontWeight: "600",
  },
  categoryCardMeta: {
    color: "#868686",
    fontSize: 13,
  },
  listCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#171717",
    backgroundColor: "#090909",
    padding: 16,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#171717",
  },
  listRowActive: {
    backgroundColor: "#0f0f0f",
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingTop: 8,
    borderRadius: 14,
  },
  listRowLast: {
    paddingBottom: 0,
    marginBottom: 0,
    borderBottomWidth: 0,
  },
  listCopy: {
    flex: 1,
    gap: 4,
  },
  listTitle: {
    color: "#f4f4f4",
    fontSize: 15,
    fontWeight: "600",
  },
  listMeta: {
    color: "#7d7d7d",
    fontSize: 12,
  },
  listValue: {
    color: "#f4f4f4",
    fontSize: 15,
    fontWeight: "700",
  },
  memoryStack: {
    gap: 10,
  },
  memoryCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    backgroundColor: "#090909",
    padding: 16,
    gap: 8,
  },
  memoryMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  memoryKind: {
    color: "#888888",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  memoryConfidence: {
    color: "#727272",
    fontSize: 12,
  },
  memoryTitle: {
    color: "#f5f5f5",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  memoryBody: {
    color: "#8b8b8b",
    fontSize: 13,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyTitle: {
    color: "#f2f2f2",
    fontSize: 18,
    fontWeight: "600",
  },
  emptyText: {
    color: "#7f7f7f",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 280,
  },
});
