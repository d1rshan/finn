import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { Container } from "@/components/container";
import {
  formatAnalyticsCategory,
  formatCategory,
  formatCurrency,
} from "@/lib/format";
import { useAnalyticsQuery } from "@/lib/finn-api";
import type { AnalyticsCategoryBreakdown, AnalyticsPeriodBucket, AnalyticsPeriodType } from "@/lib/finn-types";

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.prototype.constructor.name> = {
  food: "fast-food",
  commute: "car",
  groceries: "basket",
  shopping: "bag-handle",
  bills: "receipt",
  entertainment: "game-controller",
  health: "medical",
  travel: "airplane",
  transfer: "swap-horizontal",
  other: "ellipsis-horizontal",
};

// More muted, premium palette consistent with "Finn"
const CATEGORY_COLORS: Record<string, string> = {
  food: "#d4d4d4",
  commute: "#a3a3a3",
  groceries: "#737373",
  shopping: "#525252",
  bills: "#404040",
  entertainment: "#262626",
  health: "#e5e5e5",
  travel: "#f5f5f5",
  transfer: "#171717",
  other: "#262626",
};

function AnimatedBar({
  bucket,
  maxSpend,
  isSelected,
  onPress,
}: {
  bucket: AnalyticsPeriodBucket;
  maxSpend: number;
  isSelected: boolean;
  onPress: () => void;
}) {
  const height = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const targetHeight = Math.max(12, (bucket.totalSpend / maxSpend) * 120);
    height.value = withSpring(targetHeight, { damping: 15 });
  }, [bucket.totalSpend, maxSpend]);

  useEffect(() => {
    scale.value = withSpring(isSelected ? 1.05 : 1);
  }, [isSelected]);

  const barStyle = useAnimatedStyle(() => ({
    height: height.value,
    backgroundColor: isSelected ? "#f4f4f4" : "#262626",
    transform: [{ scaleX: scale.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: isSelected ? "#f4f4f4" : "#737373",
    fontWeight: isSelected ? "700" : "500",
  }));

  return (
    <Pressable onPress={onPress} style={styles.barContainer}>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.bar, barStyle]} />
      </View>
      <Animated.Text style={[styles.barLabel, labelStyle]}>
        {bucket.label}
      </Animated.Text>
    </Pressable>
  );
}

function CategoryProgress({
  item,
  index,
}: {
  item: AnalyticsCategoryBreakdown;
  index: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(item.percentage / 100, { duration: 800 + index * 100 });
  }, [item.percentage]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    backgroundColor: CATEGORY_COLORS[item.category] || "#444",
  }));

  const iconName = CATEGORY_ICONS[item.category] || "help-circle";

  return (
    <View style={styles.categoryRow}>
      <View style={[styles.categoryIconWrap, { backgroundColor: "#171717" }]}>
        <Ionicons name={iconName as any} size={18} color="#d4d4d4" />
      </View>
      <View style={styles.categoryInfo}>
        <View style={styles.categoryTextRow}>
          <Text style={styles.categoryName}>{formatAnalyticsCategory(item.category)}</Text>
          <Text style={styles.categoryAmount}>{formatCurrency(item.amountMinor)}</Text>
        </View>
        <View style={styles.progressBarTrack}>
          <Animated.View style={[styles.progressBarFill, progressStyle]} />
        </View>
        <Text style={styles.categoryPercent}>{item.percentage}% of total</Text>
      </View>
    </View>
  );
}

export default function AnalyticsScreen() {
  const [period, setPeriod] = useState<AnalyticsPeriodType>("weekly");
  const analyticsQuery = useAnalyticsQuery(period);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  useEffect(() => {
    if (analyticsQuery.data?.selectedPeriodId) {
      setSelectedPeriodId(analyticsQuery.data.selectedPeriodId);
    }
  }, [analyticsQuery.data?.selectedPeriodId]);

  const periods = analyticsQuery.data?.periods || [];
  const selectedIndex = periods.findIndex(p => p.id === selectedPeriodId);
  const selectedBucket = periods[selectedIndex] || periods[periods.length - 1];

  const maxSpend = useMemo(() => {
    return Math.max(...periods.map(p => p.totalSpend), 1);
  }, [periods]);

  const previousBucket = selectedIndex > 0 ? periods[selectedIndex - 1] : null;
  const changePercentage = useMemo(() => {
    if (!previousBucket || previousBucket.totalSpend === 0) return null;
    return ((selectedBucket.totalSpend - previousBucket.totalSpend) / previousBucket.totalSpend) * 100;
  }, [selectedBucket, previousBucket]);

  const dailyAverage = useMemo(() => {
    if (!selectedBucket) return 0;
    const start = new Date(selectedBucket.periodStart);
    const end = new Date(selectedBucket.periodEnd);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return selectedBucket.totalSpend / days;
  }, [selectedBucket]);

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
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>ANALYTICS</Text>
            <Text style={styles.title}>Weekly and monthly movement, without the clutter.</Text>
          </View>
        </View>

        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => setPeriod("weekly")}
            style={[styles.toggleButton, period === "weekly" ? styles.toggleButtonActive : null]}
          >
            <Text style={[styles.toggleLabel, period === "weekly" ? styles.toggleLabelActive : null]}>
              Weekly
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPeriod("monthly")}
            style={[styles.toggleButton, period === "monthly" ? styles.toggleButtonActive : null]}
          >
            <Text style={[styles.toggleLabel, period === "monthly" ? styles.toggleLabelActive : null]}>
              Monthly
            </Text>
          </Pressable>
        </View>

        {selectedBucket ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>{selectedBucket.rangeLabel}</Text>
              <Text style={styles.mainTotal}>{formatCurrency(selectedBucket.totalSpend)}</Text>
              {changePercentage !== null && (
                <View style={styles.changeRow}>
                  <Ionicons
                    name={changePercentage >= 0 ? "trending-up" : "trending-down"}
                    size={16}
                    color={changePercentage >= 0 ? "#ff6b6b" : "#1dd1a1"}
                  />
                  <Text style={[styles.changeText, { color: changePercentage >= 0 ? "#ff6b6b" : "#1dd1a1" }]}>
                    {Math.abs(changePercentage).toFixed(1)}% vs previous period
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trend</Text>
              <View style={styles.chartContainer}>
                {periods.map((p) => (
                  <AnimatedBar
                    key={p.id}
                    bucket={p}
                    maxSpend={maxSpend}
                    isSelected={p.id === selectedPeriodId}
                    onPress={() => setSelectedPeriodId(p.id)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Daily average</Text>
                <Text style={styles.statValue}>{formatCurrency(dailyAverage)}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Payments</Text>
                <Text style={styles.statValue}>{selectedBucket.transactionCount}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Category mix</Text>
              <View style={styles.categoriesCard}>
                {selectedBucket.categoryBreakdown.length > 0 ? (
                  selectedBucket.categoryBreakdown.map((item, index) => (
                    <CategoryProgress key={item.category} item={item} index={index} />
                  ))
                ) : (
                  <Text style={styles.placeholder}>No category signal yet.</Text>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top merchant</Text>
              {selectedBucket.topMerchant ? (
                <View style={styles.merchantCard}>
                  <View style={styles.merchantIcon}>
                    <Text style={styles.merchantInitial}>
                      {selectedBucket.topMerchant.merchantName.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.merchantInfo}>
                    <Text style={styles.merchantName}>{selectedBucket.topMerchant.merchantName}</Text>
                    <Text style={styles.merchantMeta}>
                      {selectedBucket.topMerchant.count} payments · {formatCurrency(selectedBucket.topMerchant.amountMinor)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#444" />
                </View>
              ) : (
                <View style={styles.merchantCard}>
                  <Text style={styles.placeholder}>No merchant signal yet.</Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="pie-chart-outline" size={48} color="#222" />
            <Text style={styles.emptyText}>Log a few expenses to unlock analytics.</Text>
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
    paddingBottom: 36,
    gap: 18,
  },
  header: {
    gap: 10,
  },
  headerText: {
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
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#0d0d0d",
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: "#171717",
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 999,
  },
  toggleButtonActive: {
    backgroundColor: "#f4f4f4",
  },
  toggleLabel: {
    color: "#8b8b8b",
    fontSize: 14,
    fontWeight: "600",
  },
  toggleLabelActive: {
    color: "#050505",
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    backgroundColor: "#0a0a0a",
    padding: 20,
    gap: 10,
  },
  cardEyebrow: {
    color: "#7e7e7e",
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  mainTotal: {
    color: "#f4f4f4",
    fontSize: 42,
    fontWeight: "600",
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  changeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  section: {
    gap: 14,
  },
  sectionTitle: {
    color: "#f7f7f7",
    fontSize: 18,
    fontWeight: "600",
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 160,
    backgroundColor: "#0a0a0a",
    borderRadius: 28,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1b1b1b",
  },
  barContainer: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  barTrack: {
    flex: 1,
    width: 12,
    backgroundColor: "#111",
    borderRadius: 6,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  bar: {
    width: "100%",
    borderRadius: 6,
  },
  barLabel: {
    fontSize: 10,
    textAlign: "center",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#090909",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    gap: 8,
  },
  statLabel: {
    color: "#6f6f6f",
    fontSize: 12,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  statValue: {
    color: "#f7f7f7",
    fontSize: 18,
    fontWeight: "600",
  },
  categoriesCard: {
    backgroundColor: "#090909",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    gap: 18,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryInfo: {
    flex: 1,
    gap: 6,
  },
  categoryTextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryName: {
    color: "#f7f7f7",
    fontSize: 15,
    fontWeight: "600",
  },
  categoryAmount: {
    color: "#f4f4f4",
    fontSize: 14,
    fontWeight: "600",
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#171717",
    borderRadius: 3,
    width: "100%",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  categoryPercent: {
    color: "#666",
    fontSize: 11,
    fontWeight: "500",
  },
  merchantCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#090909",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    gap: 16,
  },
  merchantIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1d1d1d",
  },
  merchantInitial: {
    color: "#f4f4f4",
    fontSize: 18,
    fontWeight: "600",
  },
  merchantInfo: {
    flex: 1,
    gap: 4,
  },
  merchantName: {
    color: "#f7f7f7",
    fontSize: 15,
    fontWeight: "600",
  },
  merchantMeta: {
    color: "#7d7d7d",
    fontSize: 12,
  },
  placeholder: {
    color: "#7f7f7f",
    fontSize: 14,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 16,
  },
  emptyText: {
    color: "#7f7f7f",
    fontSize: 14,
    textAlign: "center",
  },
});
