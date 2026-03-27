import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { chatWithFinn, useFeedQuery } from "@/lib/finn-api";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  bullets?: string[];
  suggestions?: string[];
  supportingSignals?: Array<{
    key: string;
    title: string;
    summary: string;
    severity: "low" | "medium" | "high";
  }>;
};

function buildHistory(messages: ChatMessage[]) {
  return messages.map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));
}

export default function ChatScreen() {
  const feedQuery = useFeedQuery();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const chatMutation = useMutation({
    mutationFn: chatWithFinn,
    onError(errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Finn could not reply.");
    },
    onSuccess(data, variables) {
      setError(null);
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-user`,
          role: "user",
          content: variables.question,
        },
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: data.answer,
          bullets: data.bullets,
          suggestions: data.suggestions,
          supportingSignals: data.supportingSignals,
        },
      ]);
      setDraft("");
    },
  });

  async function sendQuestion(question: string) {
    const trimmed = question.trim();
    if (trimmed.length < 4 || chatMutation.isPending) {
      return;
    }

    await chatMutation.mutateAsync({
      question: trimmed,
      history: buildHistory(messages),
    });
  }

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const suggestedQuestions =
    lastMessage?.suggestions?.length ? lastMessage.suggestions : (feedQuery.data?.suggestedQuestions ?? []);

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
        <View style={styles.header}>
          <Text style={styles.eyebrow}>CHAT</Text>
          <Text style={styles.title}>Ask Finn anything about your spending.</Text>
          <Text style={styles.subtitle}>
            Responses stay concise and are grounded in your transaction history and analytics.
          </Text>
        </View>

        {feedQuery.data?.snapshot?.persona ? (
          <View style={styles.contextCard}>
            <Text style={styles.contextLabel}>Current read</Text>
            <Text style={styles.contextTitle}>{feedQuery.data.snapshot.persona.label}</Text>
            <Text style={styles.contextText}>{feedQuery.data.snapshot.persona.summary}</Text>
          </View>
        ) : null}

        <View style={styles.composerCard}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Why did I spend more last week?"
            placeholderTextColor="#5f5f5f"
            multiline
          />
          <View style={styles.suggestionRow}>
            {suggestedQuestions.map((entry) => (
              <Pressable key={entry} style={styles.suggestionChip} onPress={() => void sendQuestion(entry)}>
                <Text style={styles.suggestionLabel}>{entry}</Text>
              </Pressable>
            ))}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.sendButton} onPress={() => void sendQuestion(draft)}>
            {chatMutation.isPending ? (
              <ActivityIndicator color="#050505" />
            ) : (
              <Text style={styles.sendLabel}>Send to Finn</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.chatStack}>
          {messages.length ? (
            messages.map((entry) => (
              <View
                key={entry.id}
                style={[
                  styles.messageCard,
                  entry.role === "user" ? styles.userMessageCard : styles.assistantMessageCard,
                ]}
              >
                <Text style={styles.messageRole}>
                  {entry.role === "user" ? "You" : "Finn"}
                </Text>
                <Text
                  style={[
                    styles.messageText,
                    entry.role === "user" ? styles.userMessageText : null,
                  ]}
                >
                  {entry.content}
                </Text>
                {entry.role === "assistant" && !!entry.bullets?.length ? (
                  <View style={styles.bulletStack}>
                    {entry.bullets.map((bullet) => (
                      <Text key={bullet} style={styles.bulletText}>
                        - {bullet}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {entry.role === "assistant" && !!entry.supportingSignals?.length ? (
                  <View style={styles.signalStack}>
                    {entry.supportingSignals.map((signal) => (
                      <View key={signal.key} style={styles.signalCard}>
                        <Text style={styles.signalTitle}>{signal.title}</Text>
                        <Text style={styles.signalText}>{signal.summary}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Start the conversation.</Text>
              <Text style={styles.emptyText}>
                Ask about spend spikes, blind spots, subscriptions, trends, or whether a category is drifting.
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
  },
  subtitle: {
    color: "#8d8d8d",
    fontSize: 14,
    lineHeight: 21,
  },
  contextCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1d2217",
    backgroundColor: "#11170e",
    padding: 16,
    gap: 8,
  },
  contextLabel: {
    color: "#95aa87",
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  contextTitle: {
    color: "#eef6e7",
    fontSize: 20,
    fontWeight: "700",
  },
  contextText: {
    color: "#c0cab8",
    fontSize: 14,
    lineHeight: 21,
  },
  composerCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    backgroundColor: "#090909",
    padding: 16,
    gap: 12,
  },
  input: {
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: "#f7f7f7",
    backgroundColor: "#101010",
    fontSize: 15,
    textAlignVertical: "top",
  },
  suggestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: "#212121",
  },
  suggestionLabel: {
    color: "#b6b6b6",
    fontSize: 12,
  },
  error: {
    color: "#f1c0c0",
    fontSize: 13,
  },
  sendButton: {
    borderRadius: 999,
    backgroundColor: "#f4f4f4",
    paddingVertical: 15,
    alignItems: "center",
  },
  sendLabel: {
    color: "#050505",
    fontSize: 15,
    fontWeight: "700",
  },
  chatStack: {
    gap: 12,
  },
  messageCard: {
    borderRadius: 24,
    padding: 16,
    gap: 10,
  },
  userMessageCard: {
    backgroundColor: "#f4f4f4",
  },
  assistantMessageCard: {
    backgroundColor: "#101010",
    borderWidth: 1,
    borderColor: "#1b1b1b",
  },
  messageRole: {
    color: "#7a7a7a",
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  messageText: {
    color: "#f2f2f2",
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: "#050505",
  },
  bulletStack: {
    gap: 6,
  },
  bulletText: {
    color: "#c7c7c7",
    fontSize: 13,
    lineHeight: 19,
  },
  signalStack: {
    gap: 8,
  },
  signalCard: {
    borderRadius: 16,
    backgroundColor: "#171717",
    padding: 12,
    gap: 4,
  },
  signalTitle: {
    color: "#f3f3f3",
    fontSize: 13,
    fontWeight: "700",
  },
  signalText: {
    color: "#959595",
    fontSize: 13,
    lineHeight: 19,
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
