import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { formatCategory, formatCurrency, formatDateTime } from "@/lib/format";
import { createExpense, expenseCategories, useExpensesQuery } from "@/lib/finn-api";

export default function LogScreen() {
  const queryClient = useQueryClient();
  const expensesQuery = useExpensesQuery();
  const [amount, setAmount] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [category, setCategory] = useState<(typeof expenseCategories)[number]>("food");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createExpenseMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: async () => {
      setAmount("");
      setMerchantName("");
      setCategory("food");
      setNote("");
      setError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["feed"] }),
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
      ]);
    },
    onError(errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Failed to save expense");
    },
  });

  async function handleSubmit() {
    const normalizedAmount = Number(amount.replace(/[^0-9.]/g, ""));
    if (!normalizedAmount || Number.isNaN(normalizedAmount)) {
      setError("Enter a valid amount");
      return;
    }

    if (merchantName.trim().length < 2) {
      setError("Enter a merchant or payee");
      return;
    }

    await createExpenseMutation.mutateAsync({
      amountMinor: Math.round(normalizedAmount * 100),
      merchantName: merchantName.trim(),
      category,
      note: note.trim() || undefined,
      occurredAt: new Date().toISOString(),
    });
  }

  return (
    <Container>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>LOG</Text>
          <Text style={styles.title}>One tap in. Finn handles the pattern after that.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>New expense</Text>

          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor="#5f5f5f"
            keyboardType="decimal-pad"
          />

          <TextInput
            style={styles.input}
            value={merchantName}
            onChangeText={setMerchantName}
            placeholder="Merchant or payee"
            placeholderTextColor="#5f5f5f"
          />

          <View style={styles.categoryWrap}>
            {expenseCategories.map((entry) => (
              <Pressable
                key={entry}
                style={[styles.categoryChip, category === entry ? styles.categoryChipActive : null]}
                onPress={() => setCategory(entry)}
              >
                <Text
                  style={[
                    styles.categoryLabel,
                    category === entry ? styles.categoryLabelActive : null,
                  ]}
                >
                  {formatCategory(entry)}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={[styles.input, styles.noteInput]}
            value={note}
            onChangeText={setNote}
            placeholder="Optional note"
            placeholderTextColor="#5f5f5f"
            multiline
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={styles.submitButton}
            onPress={() => void handleSubmit()}
            disabled={createExpenseMutation.isPending}
          >
            {createExpenseMutation.isPending ? (
              <ActivityIndicator color="#050505" />
            ) : (
              <Text style={styles.submitLabel}>Save payment</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Recent log</Text>
          <Text style={styles.sectionMeta}>
            {expensesQuery.data?.expenses?.length ?? 0} tracked payments
          </Text>
        </View>

        <View style={styles.historyCard}>
          {expensesQuery.data?.expenses?.length ? (
            expensesQuery.data.expenses.map((entry) => (
              <View key={entry.id} style={styles.historyRow}>
                <View style={styles.historyCopy}>
                  <Text style={styles.historyTitle}>{entry.merchantName}</Text>
                  <Text style={styles.historyMeta}>
                    {formatCategory(entry.category)} · {formatDateTime(entry.occurredAt)}
                  </Text>
                  {entry.note ? <Text style={styles.historyNote}>{entry.note}</Text> : null}
                </View>
                <Text style={styles.historyAmount}>{formatCurrency(entry.amountMinor)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.placeholder}>Your log is empty.</Text>
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
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    backgroundColor: "#0a0a0a",
    padding: 18,
    gap: 14,
  },
  cardTitle: {
    color: "#f7f7f7",
    fontSize: 18,
    fontWeight: "600",
  },
  amountInput: {
    color: "#f4f4f4",
    fontSize: 42,
    fontWeight: "600",
    borderBottomWidth: 1,
    borderBottomColor: "#1c1c1c",
    paddingBottom: 10,
  },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: "#f7f7f7",
    backgroundColor: "#101010",
    fontSize: 15,
  },
  noteInput: {
    minHeight: 86,
    textAlignVertical: "top",
  },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    backgroundColor: "#0d0d0d",
  },
  categoryChipActive: {
    backgroundColor: "#f4f4f4",
    borderColor: "#f4f4f4",
  },
  categoryLabel: {
    color: "#8a8a8a",
    fontSize: 13,
    fontWeight: "600",
  },
  categoryLabelActive: {
    color: "#050505",
  },
  error: {
    color: "#f1c0c0",
    fontSize: 13,
  },
  submitButton: {
    borderRadius: 999,
    backgroundColor: "#f4f4f4",
    paddingVertical: 16,
    alignItems: "center",
  },
  submitLabel: {
    color: "#050505",
    fontSize: 15,
    fontWeight: "700",
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#f7f7f7",
    fontSize: 18,
    fontWeight: "600",
  },
  sectionMeta: {
    color: "#7f7f7f",
    fontSize: 12,
  },
  historyCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    backgroundColor: "#090909",
    padding: 16,
    gap: 16,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  historyCopy: {
    flex: 1,
    gap: 4,
  },
  historyTitle: {
    color: "#f7f7f7",
    fontSize: 15,
    fontWeight: "600",
  },
  historyMeta: {
    color: "#818181",
    fontSize: 12,
  },
  historyNote: {
    color: "#6d6d6d",
    fontSize: 12,
  },
  historyAmount: {
    color: "#f4f4f4",
    fontSize: 15,
    fontWeight: "700",
  },
  placeholder: {
    color: "#7f7f7f",
    fontSize: 14,
  },
});
