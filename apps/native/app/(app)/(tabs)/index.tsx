import { Ionicons } from "@expo/vector-icons";
import { Link, type Href } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import { formatCategory, formatCurrency, formatDateTime } from "@/lib/format";
import { useFeedQuery } from "@/lib/finn-api";

export default function HomeScreen() {
  const feedQuery = useFeedQuery();
  const session = authClient.useSession();
  const snapshot = feedQuery.data?.snapshot;

  return (
    <Container>
      <ScrollView
        refreshControl={
          <RefreshControl
            tintColor="#f4f4f4"
            refreshing={feedQuery.isRefetching}
            onRefresh={() => void feedQuery.refetch()}
          />
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>FINN</Text>
            <Text style={styles.title}>Quietly watching what your money is doing.</Text>
          </View>

          <View style={styles.headerActions}>
            <Text style={styles.userInitial}>
              {session.data?.user?.name?.slice(0, 1).toUpperCase() ?? "F"}
            </Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Inbox</Text>
          <Text style={styles.heroText}>
            Every expense sharpens Finn’s memory. The feed below is where it reaches out when a
            pattern starts to matter.
          </Text>
        </View>

        {snapshot?.persona ? (
          <View style={styles.personaCard}>
            <Text style={styles.personaEyebrow}>Behavioral persona</Text>
            <Text style={styles.personaTitle}>{snapshot.persona.label}</Text>
            <Text style={styles.personaText}>{snapshot.persona.summary}</Text>
            {snapshot.emotionalSpendingFingerprint ? (
              <Text style={styles.personaFootnote}>{snapshot.emotionalSpendingFingerprint}</Text>
            ) : null}
          </View>
        ) : null}

        {feedQuery.data?.insights?.length ? (
          <View style={styles.stack}>
            {feedQuery.data.insights.map((entry, index) => (
              <View
                key={entry.id}
                style={[styles.messageCard, index === 0 ? styles.messagePrimary : null]}
              >
                <View style={styles.messageMeta}>
                  <Text style={styles.messageSender}>Finn</Text>
                  <Text style={styles.messageDate}>{formatDateTime(entry.createdAt)}</Text>
                </View>
                <Text style={[styles.messageTitle, index === 0 ? styles.messageTitlePrimary : null]}>
                  {entry.title}
                </Text>
                <Text style={[styles.messageBody, index === 0 ? styles.messageBodyPrimary : null]}>
                  {entry.body}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No messages yet.</Text>
            <Text style={styles.emptyText}>
              Log your first few payments and Finn will start spotting habits, spikes, and repeat
              merchants.
            </Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent payments</Text>
          <Link href={"/(app)/(tabs)/log" as Href} style={styles.sectionLink}>
            Add one
          </Link>
        </View>

        {snapshot?.behavioralSignals?.length ? (
          <View style={styles.signalCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Behavioral signals</Text>
            </View>
            {snapshot.behavioralSignals.slice(0, 3).map((entry) => (
              <View key={entry.key} style={styles.signalRow}>
                <Text style={styles.signalTitle}>{entry.title}</Text>
                <Text style={styles.signalText}>{entry.summary}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.listCard}>
          {feedQuery.data?.recentExpenses?.length ? (
            feedQuery.data.recentExpenses.map((entry) => (
              <View key={entry.id} style={styles.row}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{entry.merchantName}</Text>
                  <Text style={styles.rowMeta}>
                    {formatCategory(entry.category)} · {formatDateTime(entry.occurredAt)}
                  </Text>
                </View>
                <Text style={styles.rowAmount}>{formatCurrency(entry.amountMinor)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.placeholder}>Nothing logged yet.</Text>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Report prompts</Text>
          <Link href={"/(app)/(tabs)/reports" as Href} style={styles.sectionLink}>
            See all
          </Link>
        </View>

        <View style={styles.stack}>
          {feedQuery.data?.reportPrompts?.length ? (
            feedQuery.data.reportPrompts.map((entry) => (
              <Link
                href={`/(app)/reports/${entry.id}` as Href}
                key={entry.id}
                style={styles.reportCard}
              >
                <View style={styles.reportHead}>
                  <Text style={styles.reportBadge}>{entry.periodType.toUpperCase()}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#6d6d6d" />
                </View>
                <Text style={styles.reportTitle}>{entry.title}</Text>
                <Text style={styles.reportSummary}>{entry.summary}</Text>
              </Link>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Reports will appear here.</Text>
              <Text style={styles.emptyText}>
                Weekly and monthly summaries unlock automatically as you log activity.
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
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: {
    flex: 1,
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
  headerActions: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#1d1d1d",
    alignItems: "center",
    justifyContent: "center",
  },
  userInitial: {
    color: "#f4f4f4",
    fontSize: 14,
    fontWeight: "700",
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    backgroundColor: "#0b0b0b",
    padding: 20,
    gap: 10,
  },
  heroTitle: {
    color: "#f7f7f7",
    fontSize: 18,
    fontWeight: "600",
  },
  heroText: {
    color: "#989898",
    fontSize: 14,
    lineHeight: 22,
  },
  personaCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#1d2217",
    backgroundColor: "#11170e",
    padding: 20,
    gap: 10,
  },
  personaEyebrow: {
    color: "#93a884",
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  personaTitle: {
    color: "#f1f7eb",
    fontSize: 22,
    fontWeight: "700",
  },
  personaText: {
    color: "#c3ceb8",
    fontSize: 14,
    lineHeight: 21,
  },
  personaFootnote: {
    color: "#8ca07d",
    fontSize: 13,
    lineHeight: 20,
  },
  stack: {
    gap: 12,
  },
  messageCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#191919",
    gap: 10,
  },
  messagePrimary: {
    backgroundColor: "#f4f4f4",
    borderColor: "#f4f4f4",
  },
  messageMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  messageSender: {
    color: "#7a7a7a",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.8,
  },
  messageDate: {
    color: "#7a7a7a",
    fontSize: 12,
  },
  messageTitle: {
    color: "#f7f7f7",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600",
  },
  messageBody: {
    color: "#afafaf",
    fontSize: 14,
    lineHeight: 22,
  },
  messageTitlePrimary: {
    color: "#050505",
  },
  messageBodyPrimary: {
    color: "#2b2b2b",
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#f4f4f4",
    fontSize: 18,
    fontWeight: "600",
  },
  sectionLink: {
    color: "#8d8d8d",
    fontSize: 13,
  },
  listCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    backgroundColor: "#090909",
    padding: 16,
    gap: 14,
  },
  signalCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    backgroundColor: "#090909",
    padding: 16,
    gap: 12,
  },
  signalRow: {
    gap: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#171717",
  },
  signalTitle: {
    color: "#f2f2f2",
    fontSize: 14,
    fontWeight: "600",
  },
  signalText: {
    color: "#8a8a8a",
    fontSize: 13,
    lineHeight: 19,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowCopy: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: "#f7f7f7",
    fontSize: 15,
    fontWeight: "600",
  },
  rowMeta: {
    color: "#7d7d7d",
    fontSize: 12,
  },
  rowAmount: {
    color: "#f4f4f4",
    fontSize: 15,
    fontWeight: "700",
  },
  placeholder: {
    color: "#7f7f7f",
    fontSize: 14,
  },
  reportCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    backgroundColor: "#0b0b0b",
    padding: 18,
    gap: 10,
  },
  reportHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reportBadge: {
    color: "#7f7f7f",
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  reportTitle: {
    color: "#f7f7f7",
    fontSize: 18,
    fontWeight: "600",
  },
  reportSummary: {
    color: "#929292",
    fontSize: 14,
    lineHeight: 21,
  },
});
