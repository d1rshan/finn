import { Link, type Href } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { formatCurrency, formatDateTime, formatPeriodType } from "@/lib/format";
import { useReportsQuery } from "@/lib/finn-api";

export default function ReportsScreen() {
  const reportsQuery = useReportsQuery();

  return (
    <Container>
      <ScrollView
        refreshControl={
          <RefreshControl
            tintColor="#f4f4f4"
            refreshing={reportsQuery.isRefetching}
            onRefresh={() => void reportsQuery.refetch()}
          />
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>REPORTS</Text>
          <Text style={styles.title}>The bigger picture, rendered from what you actually spent.</Text>
        </View>

        <View style={styles.stack}>
          {reportsQuery.data?.reports?.length ? (
            reportsQuery.data.reports.map((entry) => (
              <Link href={`/(app)/reports/${entry.id}` as Href} key={entry.id} style={styles.card}>
                <View style={styles.cardMeta}>
                  <Text style={styles.badge}>{formatPeriodType(entry.periodType)}</Text>
                  <Text style={styles.date}>{formatDateTime(entry.periodStart)}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{entry.title}</Text>
                  <Text style={styles.summary}>{entry.summary}</Text>
                </View>
                <View style={styles.metricsRow}>
                  {entry.metadata.metrics.slice(0, 3).map((metric: (typeof entry.metadata.metrics)[number]) => (
                    <View key={metric.label} style={styles.metric}>
                      <Text style={styles.metricLabel}>{metric.label}</Text>
                      <Text style={styles.metricValue}>
                        {metric.label === "Transactions"
                          ? metric.value
                          : formatCurrency(metric.value)}
                      </Text>
                    </View>
                  ))}
                </View>
              </Link>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No reports yet.</Text>
              <Text style={styles.emptyText}>
                Finn needs a few logged payments before weekly and monthly summaries make sense.
              </Text>
            </View>
          )}
        </View>
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
    maxWidth: 320,
  },
  stack: {
    gap: 14,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 14,
  },
  cardMeta: {
    gap: 4,
  },
  cardBody: {
    gap: 8,
    paddingTop: 2,
  },
  badge: {
    color: "#7e7e7e",
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  date: {
    color: "#6e6e6e",
    fontSize: 12,
    lineHeight: 16,
  },
  cardTitle: {
    color: "#f7f7f7",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "600",
  },
  summary: {
    color: "#929292",
    fontSize: 13,
    lineHeight: 21,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metric: {
    minWidth: "47%",
    flexGrow: 1,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#171717",
    gap: 6,
  },
  metricLabel: {
    color: "#757575",
    fontSize: 12,
    lineHeight: 16,
  },
  metricValue: {
    color: "#f4f4f4",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  emptyCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    padding: 18,
    gap: 8,
    backgroundColor: "#090909",
  },
  emptyTitle: {
    color: "#f7f7f7",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyText: {
    color: "#8e8e8e",
    fontSize: 14,
    lineHeight: 21,
  },
});
