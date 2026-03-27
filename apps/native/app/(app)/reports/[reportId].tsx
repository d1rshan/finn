import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import {
  formatCategory,
  formatCurrency,
  formatDateTime,
  formatMetricValue,
  formatPeriodType,
} from "@/lib/format";
import { useReportDetailQuery } from "@/lib/finn-api";

export default function ReportDetailScreen() {
  const params = useLocalSearchParams<{ reportId: string }>();
  const reportQuery = useReportDetailQuery(params.reportId);

  const report = reportQuery.data?.report;

  return (
    <Container>
      <Stack.Screen
        options={{
          headerShown: true,
          title: report?.title ?? "Report",
          headerStyle: { backgroundColor: "#050505" },
          headerTintColor: "#f4f4f4",
          headerShadowVisible: false,
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {report ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>{formatPeriodType(report.periodType)}</Text>
              <Text style={styles.title}>{report.title}</Text>
              <Text style={styles.summary}>{report.summary}</Text>
            </View>

            {report.metadata.persona ? (
              <View style={styles.personaCard}>
                <Text style={styles.sectionTitle}>Persona</Text>
                <Text style={styles.personaTitle}>{report.metadata.persona.label}</Text>
                <Text style={styles.personaText}>{report.metadata.persona.summary}</Text>
                {report.metadata.emotionalSpendingFingerprint ? (
                  <Text style={styles.personaFootnote}>
                    {report.metadata.emotionalSpendingFingerprint}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.metricsCard}>
              {report.metadata.metrics.map((metric: (typeof report.metadata.metrics)[number]) => (
                <View key={metric.label} style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                  <Text style={styles.metricValue}>{formatMetricValue(metric)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.dualCard}>
              <View style={styles.dualSection}>
                <Text style={styles.sectionTitle}>Top categories</Text>
                {report.metadata.topCategories.length ? (
                  report.metadata.topCategories.map(
                    (entry: (typeof report.metadata.topCategories)[number]) => (
                    <View key={entry.category} style={styles.miniRow}>
                      <Text style={styles.miniTitle}>{formatCategory(entry.category)}</Text>
                      <Text style={styles.miniValue}>
                        {formatCurrency(entry.amountMinor)} · {entry.percentage}%
                      </Text>
                    </View>
                    ),
                  )
                ) : (
                  <Text style={styles.placeholder}>No category signal yet.</Text>
                )}
              </View>

              <View style={styles.divider} />

              <View style={styles.dualSection}>
                <Text style={styles.sectionTitle}>Top merchants</Text>
                {report.metadata.topMerchants.length ? (
                  report.metadata.topMerchants.map(
                    (entry: (typeof report.metadata.topMerchants)[number]) => (
                    <View key={entry.merchantName} style={styles.miniRow}>
                      <Text style={styles.miniTitle}>{entry.merchantName}</Text>
                      <Text style={styles.miniValue}>
                        {formatCurrency(entry.amountMinor)} · {entry.count}x
                      </Text>
                    </View>
                    ),
                  )
                ) : (
                  <Text style={styles.placeholder}>No merchant signal yet.</Text>
                )}
              </View>
            </View>

            {report.metadata.behavioralSignals.length ? (
              <View style={styles.expensesCard}>
                <Text style={styles.sectionTitle}>Behavioral signals</Text>
                {report.metadata.behavioralSignals.map(
                  (entry: (typeof report.metadata.behavioralSignals)[number]) => (
                    <View key={entry.key} style={styles.signalRow}>
                      <Text style={styles.signalTitle}>{entry.title}</Text>
                      <Text style={styles.signalText}>{entry.summary}</Text>
                    </View>
                  ),
                )}
              </View>
            ) : null}

            {(report.metadata.projections.length ||
              report.metadata.recurringCharges.length ||
              report.metadata.unusualSilence.length) ? (
              <View style={styles.dualCard}>
                <View style={styles.dualSection}>
                  <Text style={styles.sectionTitle}>Projections</Text>
                  {report.metadata.projections.length ? (
                    report.metadata.projections.map(
                      (entry: (typeof report.metadata.projections)[number]) => (
                        <View key={entry.category} style={styles.miniRow}>
                          <Text style={styles.miniTitle}>{formatCategory(entry.category)}</Text>
                          <Text style={styles.miniValue}>
                            {formatCurrency(entry.projectedAmountMinor)}
                          </Text>
                        </View>
                      ),
                    )
                  ) : (
                    <Text style={styles.placeholder}>No projection signal yet.</Text>
                  )}
                </View>

                <View style={styles.divider} />

                <View style={styles.dualSection}>
                  <Text style={styles.sectionTitle}>Recurring charges</Text>
                  {report.metadata.recurringCharges.length ? (
                    report.metadata.recurringCharges.map(
                      (entry: (typeof report.metadata.recurringCharges)[number]) => (
                        <View key={entry.merchantName} style={styles.miniRow}>
                          <Text style={styles.miniTitle}>{entry.merchantName}</Text>
                          <Text style={styles.miniValue}>
                            {formatCurrency(entry.amountMinor)} · every {entry.cadenceDays}d
                          </Text>
                        </View>
                      ),
                    )
                  ) : (
                    <Text style={styles.placeholder}>No recurring charge found.</Text>
                  )}
                </View>
              </View>
            ) : null}

            {(report.metadata.dayOfWeekSpend.length || report.metadata.guiltIndex) ? (
              <View style={styles.expensesCard}>
                <Text style={styles.sectionTitle}>Rhythm</Text>
                {report.metadata.dayOfWeekSpend
                  .filter((entry: (typeof report.metadata.dayOfWeekSpend)[number]) => entry.amountMinor > 0)
                  .slice(0, 4)
                  .map((entry: (typeof report.metadata.dayOfWeekSpend)[number]) => (
                    <View key={entry.day} style={styles.expenseRow}>
                      <Text style={styles.miniTitle}>{entry.day}</Text>
                      <Text style={styles.miniValue}>
                        {formatCurrency(entry.averageAmountMinor)} avg
                      </Text>
                    </View>
                  ))}
                {report.metadata.endOfMonthCrunch ? (
                  <Text style={styles.footnote}>{report.metadata.endOfMonthCrunch}</Text>
                ) : null}
                {report.metadata.guiltIndex ? (
                  <Text style={styles.footnote}>{report.metadata.guiltIndex.summary}</Text>
                ) : null}
                {report.metadata.unusualSilence.length ? (
                  <Text style={styles.footnote}>
                    Quiet categories:{" "}
                    {report.metadata.unusualSilence
                      .map((entry: (typeof report.metadata.unusualSilence)[number]) =>
                        formatCategory(entry.category),
                      )
                      .join(", ")}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.expensesCard}>
              <Text style={styles.sectionTitle}>Transactions in this period</Text>
              {reportQuery.data?.expenses?.length ? (
                reportQuery.data.expenses.map((entry) => (
                  <View key={entry.id} style={styles.expenseRow}>
                    <View style={styles.expenseCopy}>
                      <Text style={styles.expenseTitle}>{entry.merchantName}</Text>
                      <Text style={styles.expenseMeta}>
                        {formatCategory(entry.category)} · {formatDateTime(entry.occurredAt)}
                      </Text>
                    </View>
                    <Text style={styles.expenseAmount}>{formatCurrency(entry.amountMinor)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.placeholder}>No transactions found for this window.</Text>
              )}
            </View>
          </>
        ) : (
          <Text style={styles.placeholder}>Loading report…</Text>
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
  hero: {
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
  summary: {
    color: "#939393",
    fontSize: 15,
    lineHeight: 22,
  },
  personaCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1d2217",
    backgroundColor: "#11170e",
    padding: 16,
    gap: 8,
  },
  personaTitle: {
    color: "#eef6e7",
    fontSize: 20,
    fontWeight: "700",
  },
  personaText: {
    color: "#c0cab8",
    fontSize: 14,
    lineHeight: 21,
  },
  personaFootnote: {
    color: "#8ea382",
    fontSize: 13,
    lineHeight: 19,
  },
  metricsCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    backgroundColor: "#0a0a0a",
    padding: 16,
    gap: 14,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricLabel: {
    color: "#888888",
    fontSize: 14,
  },
  metricValue: {
    color: "#f4f4f4",
    fontSize: 14,
    fontWeight: "700",
  },
  dualCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    backgroundColor: "#090909",
    padding: 16,
    gap: 16,
  },
  dualSection: {
    gap: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "#171717",
  },
  sectionTitle: {
    color: "#f7f7f7",
    fontSize: 16,
    fontWeight: "600",
  },
  miniRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  miniTitle: {
    color: "#d7d7d7",
    fontSize: 14,
  },
  miniValue: {
    color: "#7c7c7c",
    fontSize: 13,
  },
  signalRow: {
    gap: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#171717",
  },
  signalTitle: {
    color: "#f4f4f4",
    fontSize: 14,
    fontWeight: "600",
  },
  signalText: {
    color: "#8c8c8c",
    fontSize: 13,
    lineHeight: 19,
  },
  expensesCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    backgroundColor: "#090909",
    padding: 16,
    gap: 16,
  },
  expenseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  expenseCopy: {
    flex: 1,
    gap: 4,
  },
  expenseTitle: {
    color: "#f7f7f7",
    fontSize: 15,
    fontWeight: "600",
  },
  expenseMeta: {
    color: "#818181",
    fontSize: 12,
  },
  expenseAmount: {
    color: "#f4f4f4",
    fontSize: 15,
    fontWeight: "700",
  },
  footnote: {
    color: "#8d8d8d",
    fontSize: 13,
    lineHeight: 19,
  },
  placeholder: {
    color: "#7f7f7f",
    fontSize: 14,
  },
});
