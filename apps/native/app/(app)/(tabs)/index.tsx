import { Ionicons } from "@expo/vector-icons";
import { Link, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import { formatCategory, formatCurrency, formatDateTime, formatMemoryFactKind } from "@/lib/format";
import { useFeedQuery } from "@/lib/finn-api";

function severityTone(severity: "low" | "medium" | "high") {
  if (severity === "high") {
    return {
      border: "#3a2828",
      background: "#171010",
      badgeBackground: "#241515",
      badgeText: "#f1b6b6",
    };
  }

  if (severity === "medium") {
    return {
      border: "#2f3022",
      background: "#14140f",
      badgeBackground: "#1f2015",
      badgeText: "#d8d79c",
    };
  }

  return {
    border: "#1b2b26",
    background: "#0e1513",
    badgeBackground: "#13201c",
    badgeText: "#9ecfbc",
  };
}

export default function HomeScreen() {
  const feedQuery = useFeedQuery();
  const session = authClient.useSession();
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState(false);

  const primaryInsight = feedQuery.data?.insights?.[0] ?? null;
  const secondaryInsights = useMemo(
    () => (feedQuery.data?.insights ?? []).slice(1, 3),
    [feedQuery.data?.insights],
  );
  const signalRows = useMemo(
    () =>
      (feedQuery.data?.snapshot.behavioralSignals ?? [])
        .filter((entry) => entry.title !== primaryInsight?.title)
        .slice(0, 3),
    [feedQuery.data?.snapshot.behavioralSignals, primaryInsight?.title],
  );
  const memoryFacts = useMemo(() => (feedQuery.data?.memoryFacts ?? []).slice(0, 3), [feedQuery.data?.memoryFacts]);
  const recentExpenses = feedQuery.data?.recentExpenses ?? [];
  const hasActivity = Boolean(
    primaryInsight || secondaryInsights.length || signalRows.length || memoryFacts.length || recentExpenses.length,
  );
  const tone = severityTone(primaryInsight?.severity ?? "low");

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
            <Text style={styles.title}>Your money, reduced to what matters right now.</Text>
            <Text style={styles.subtitle}>
              Review the strongest signal, scan recent movement, then decide what to do next.
            </Text>
          </View>

          <Pressable
            style={styles.headerActions}
            onPress={() => {
              setIsAccountSheetOpen(true);
            }}
          >
            <Text style={styles.userInitial}>
              {session.data?.user?.name?.slice(0, 1).toUpperCase() ?? "F"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.quickActions}>
          <Link href={"/(app)/(tabs)/chat" as Href} asChild>
            <Pressable style={[styles.quickAction, styles.quickActionPrimary]}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color="#050505" />
              <Text style={styles.quickActionPrimaryText}>Ask Finn</Text>
            </Pressable>
          </Link>

          <Link href={"/(app)/(tabs)/log" as Href} asChild>
            <Pressable style={styles.quickAction}>
              <Ionicons name="add-circle-outline" size={16} color="#d9d9d9" />
              <Text style={styles.quickActionText}>Log payment</Text>
            </Pressable>
          </Link>
        </View>

        {hasActivity ? (
          <>
            {primaryInsight ? (
              <View
                style={[
                  styles.primaryCard,
                  {
                    borderColor: tone.border,
                    backgroundColor: tone.background,
                  },
                ]}
              >
                <View style={styles.primaryMeta}>
                  <View
                    style={[
                      styles.severityBadge,
                      {
                        backgroundColor: tone.badgeBackground,
                      },
                    ]}
                  >
                    <Text style={[styles.severityText, { color: tone.badgeText }]}>
                      {primaryInsight.severity} priority
                    </Text>
                  </View>
                  <Text style={styles.primaryDate}>{formatDateTime(primaryInsight.createdAt)}</Text>
                </View>

                <Text style={styles.primaryTitle}>{primaryInsight.title}</Text>
                <Text style={styles.primaryBody}>{primaryInsight.body}</Text>
              </View>
            ) : null}

            {secondaryInsights.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Worth watching</Text>
                </View>

                <View style={styles.stack}>
                  {secondaryInsights.map((entry) => (
                    <View key={entry.id} style={styles.insightRow}>
                      <View style={styles.insightIcon}>
                        <Ionicons name="sparkles-outline" size={16} color="#d9d9d9" />
                      </View>
                      <View style={styles.insightCopy}>
                        <Text style={styles.insightTitle}>{entry.title}</Text>
                        <Text style={styles.insightBody}>{entry.body}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {signalRows.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Signals</Text>
                </View>

                <View style={styles.listCard}>
                  {signalRows.map((entry, index) => (
                    <View
                      key={entry.key}
                      style={[styles.signalRow, index === signalRows.length - 1 ? styles.signalRowLast : null]}
                    >
                      <Text style={styles.signalTitle}>{entry.title}</Text>
                      <Text style={styles.signalText}>{entry.summary}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {memoryFacts.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>What Finn remembers</Text>
                </View>

                <View style={styles.stack}>
                  {memoryFacts.map((entry) => (
                    <View key={entry.id} style={styles.memoryCard}>
                      <View style={styles.memoryMeta}>
                        <Text style={styles.memoryKind}>{formatMemoryFactKind(entry.kind)}</Text>
                        <Text style={styles.memoryConfidence}>{entry.confidence}% confidence</Text>
                      </View>
                      <Text style={styles.memoryTitle}>{entry.title}</Text>
                      <Text style={styles.memoryBody}>{entry.body}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent payments</Text>
                <Link href={"/(app)/(tabs)/log" as Href} style={styles.sectionLink}>
                  Add one
                </Link>
              </View>

              <View style={styles.listCard}>
                {recentExpenses.length ? (
                  recentExpenses.slice(0, 6).map((entry, index) => (
                    <View key={entry.id} style={[styles.row, index === recentExpenses.length - 1 ? styles.rowLast : null]}>
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
                  <Text style={styles.placeholder}>No payments logged yet.</Text>
                )}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing useful to say yet.</Text>
            <Text style={styles.emptyText}>
              Add a few payments first. Finn only becomes sharp once there is enough real activity to read.
            </Text>

            <Link href={"/(app)/(tabs)/log" as Href} asChild>
              <Pressable style={styles.emptyAction}>
                <Text style={styles.emptyActionText}>Log your first payment</Text>
              </Pressable>
            </Link>
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={isAccountSheetOpen}
        onRequestClose={() => {
          setIsAccountSheetOpen(false);
        }}
      >
        <View style={styles.sheetRoot}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => {
              setIsAccountSheetOpen(false);
            }}
          />

          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>Account</Text>
            <View style={styles.sheetProfile}>
              <View style={styles.sheetAvatar}>
                <Text style={styles.sheetAvatarLabel}>
                  {(session.data?.user?.name ?? session.data?.user?.email ?? "F").charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.sheetProfileBody}>
                <Text style={styles.sheetTitle}>{session.data?.user?.name ?? "Finn user"}</Text>
                <Text style={styles.sheetEmail}>{session.data?.user?.email ?? "No email found"}</Text>
              </View>
            </View>

            <Pressable
              style={styles.logoutButton}
              onPress={() => {
                setIsAccountSheetOpen(false);
                authClient.signOut();
              }}
            >
              <Text style={styles.logoutLabel}>Log out</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Container>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
    gap: 20,
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
    lineHeight: 35,
    fontWeight: "600",
    maxWidth: 320,
  },
  subtitle: {
    color: "#878787",
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 300,
  },
  headerActions: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#1d1d1d",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b0b0b",
  },
  userInitial: {
    color: "#f4f4f4",
    fontSize: 14,
    fontWeight: "700",
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1d1d1d",
    backgroundColor: "#0b0b0b",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quickActionPrimary: {
    backgroundColor: "#f4f4f4",
    borderColor: "#f4f4f4",
  },
  quickActionText: {
    color: "#d9d9d9",
    fontSize: 13,
    fontWeight: "600",
  },
  quickActionPrimaryText: {
    color: "#050505",
    fontSize: 13,
    fontWeight: "700",
  },
  primaryCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  primaryMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  severityBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  severityText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  primaryDate: {
    color: "#767676",
    fontSize: 12,
  },
  primaryTitle: {
    color: "#f6f6f6",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
  },
  primaryBody: {
    color: "#b0b0b0",
    fontSize: 14,
    lineHeight: 22,
  },
  section: {
    gap: 12,
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
  stack: {
    gap: 10,
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#181818",
    backgroundColor: "#0b0b0b",
    padding: 16,
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#131313",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  insightCopy: {
    flex: 1,
    gap: 5,
  },
  insightTitle: {
    color: "#f1f1f1",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  insightBody: {
    color: "#8f8f8f",
    fontSize: 13,
    lineHeight: 19,
  },
  listCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#171717",
    backgroundColor: "#090909",
    padding: 16,
  },
  memoryCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#191919",
    backgroundColor: "#0a0a0a",
    padding: 16,
    gap: 8,
  },
  memoryMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  memoryKind: {
    color: "#8b8b8b",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  memoryConfidence: {
    color: "#5f5f5f",
    fontSize: 12,
  },
  memoryTitle: {
    color: "#f4f4f4",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  memoryBody: {
    color: "#8d8d8d",
    fontSize: 13,
    lineHeight: 20,
  },
  signalRow: {
    gap: 4,
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#171717",
  },
  signalRowLast: {
    paddingBottom: 0,
    marginBottom: 0,
    borderBottomWidth: 0,
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
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#171717",
  },
  rowLast: {
    paddingBottom: 0,
    marginBottom: 0,
    borderBottomWidth: 0,
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
  emptyCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#171717",
    backgroundColor: "#0a0a0a",
    padding: 22,
    gap: 12,
  },
  emptyTitle: {
    color: "#f7f7f7",
    fontSize: 20,
    fontWeight: "600",
  },
  emptyText: {
    color: "#8e8e8e",
    fontSize: 14,
    lineHeight: 22,
  },
  emptyAction: {
    alignSelf: "flex-start",
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: "#f4f4f4",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyActionText: {
    color: "#050505",
    fontSize: 13,
    fontWeight: "700",
  },
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#1b1b1b",
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 14,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#2a2a2a",
    marginBottom: 8,
  },
  sheetEyebrow: {
    color: "#777777",
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  sheetProfile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  sheetAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#131313",
    borderWidth: 1,
    borderColor: "#232323",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  sheetAvatarLabel: {
    color: "#f5f5f5",
    fontSize: 20,
    fontWeight: "700",
  },
  sheetProfileBody: {
    flex: 1,
    gap: 3,
  },
  sheetTitle: {
    color: "#f7f7f7",
    fontSize: 22,
    fontWeight: "600",
  },
  sheetEmail: {
    color: "#929292",
    fontSize: 14,
  },
  logoutButton: {
    marginTop: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "#f4f4f4",
  },
  logoutLabel: {
    color: "#050505",
    fontSize: 15,
    fontWeight: "700",
  },
});
