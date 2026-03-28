import { useChat } from "@ai-sdk/react";
import { Ionicons } from "@expo/vector-icons";
import { DefaultChatTransport } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import { useFeedQuery } from "@/lib/finn-api";
import { env } from "@finn/env/native";

const supportingSignalSchema = z.object({
  key: z.string(),
  title: z.string(),
  summary: z.string(),
  severity: z.enum(["low", "medium", "high"]),
});

const finnDataSchema = z.object({
  bullets: z.array(z.string()),
  suggestions: z.array(z.string()),
  supportingSignals: z.array(supportingSignalSchema),
});

function extractText(parts: Array<{ type?: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

function extractFinnData(parts: Array<{ type?: string; data?: unknown }>) {
  const finnPart = parts.find((part) => part.type === "data-finn");
  const parsed = finnDataSchema.safeParse(finnPart?.data);
  return parsed.success ? parsed.data : null;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const feedQuery = useFeedQuery();
  const [input, setInput] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${env.EXPO_PUBLIC_SERVER_URL}/api/chat`,
        fetch: expoFetch as unknown as typeof globalThis.fetch,
      }),
    [],
  );

  const { messages, error, sendMessage, status } = useChat({
    transport,
    dataPartSchemas: {
      finn: finnDataSchema,
    },
    experimental_throttle: 50,
    onError: (streamError) => {
      console.error(streamError, "Finn chat error");
    },
  });

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, status]);

  const isStreaming = status === "submitted" || status === "streaming";
  const lastAssistantData =
    ([...messages].reverse().find((message) => message.role === "assistant")?.parts ?? []) as Array<{
      type?: string;
      data?: unknown;
    }>;
  const latestFinnData = extractFinnData(lastAssistantData);
  const suggestedQuestions =
    latestFinnData?.suggestions?.length ? latestFinnData.suggestions : (feedQuery.data?.suggestedQuestions ?? []);

  async function onSubmit(question: string) {
    const trimmed = question.trim();
    if (trimmed.length < 4 || isStreaming) {
      return;
    }

    const cookie = authClient.getCookie();
    setInput("");

    await sendMessage(
      { text: trimmed },
      {
        headers: cookie ? { cookie } : undefined,
      },
    );
  }

  return (
    <Container>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ask Finn</Text>
          <Text style={styles.headerSubtitle}>Personal Finance Analyst</Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Chat unavailable</Text>
            <Text style={styles.errorBody}>{error.message}</Text>
          </View>
        ) : null}

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles-outline" size={40} color="#333" />
              </View>
              <Text style={styles.emptyTitle}>How can I help you today?</Text>
              <View style={styles.suggestions}>
                {suggestedQuestions.map((question) => (
                  <Pressable
                    key={question}
                    style={styles.suggestionItem}
                    onPress={() => void onSubmit(question)}
                  >
                    <Text style={styles.suggestionText}>{question}</Text>
                    <Ionicons name="arrow-forward" size={14} color="#666" />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.messagesList}>
              {messages.map((message, index) => {
                const isUser = message.role === "user";
                const parts = message.parts as Array<{ type?: string; text?: string; data?: unknown }>;
                const text = extractText(parts);
                const finnData = extractFinnData(parts);
                const isLatestAssistant = !isUser && index === messages.length - 1 && isStreaming;
                const showStructuredData = !isUser && !isLatestAssistant && Boolean(finnData);

                return (
                  <View
                    key={message.id}
                    style={[
                      styles.messageWrapper,
                      isUser ? styles.userWrapper : styles.assistantWrapper,
                    ]}
                  >
                    {!isUser ? (
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>F</Text>
                      </View>
                    ) : null}

                    <View
                      style={[
                        styles.messageBubble,
                        isUser ? styles.userBubble : styles.assistantBubble,
                      ]}
                    >
                      {text ? (
                        <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
                          {text}
                          {isLatestAssistant ? <Text style={styles.cursor}>|</Text> : null}
                        </Text>
                      ) : null}

                      {showStructuredData && finnData?.bullets?.length ? (
                        <View style={styles.bulletsContainer}>
                          {finnData.bullets.map((bullet) => (
                            <View key={bullet} style={styles.bulletRow}>
                              <Text style={styles.bulletDot}>•</Text>
                              <Text style={styles.bulletText}>{bullet}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      {showStructuredData && finnData?.supportingSignals?.length ? (
                        <View style={styles.signalsContainer}>
                          {finnData.supportingSignals.map((signal) => (
                            <View key={signal.key} style={styles.signalCard}>
                              <Text style={styles.signalTitle}>{signal.title}</Text>
                              <Text style={styles.signalBody}>{signal.summary}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {!!messages.length && suggestedQuestions.length ? (
          <View style={styles.followupsBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.followups}
            >
              {suggestedQuestions.map((question) => (
                <Pressable
                  key={question}
                  style={styles.followupChip}
                  onPress={() => void onSubmit(question)}
                  disabled={isStreaming}
                >
                  <Text style={styles.followupText} numberOfLines={1}>
                    {question}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={[styles.inputContainer, { marginBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Ask anything..."
              placeholderTextColor="#666"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
              onSubmitEditing={(event) => {
                event.preventDefault();
                void onSubmit(input);
              }}
            />
            <Pressable
              style={[styles.sendButton, (!input.trim() || isStreaming) && styles.sendButtonDisabled]}
              onPress={() => void onSubmit(input)}
              disabled={!input.trim() || isStreaming}
            >
              {isStreaming ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Ionicons name="arrow-up" size={20} color="#000" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Container>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#111",
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#666",
    fontSize: 12,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  messagesList: {
    gap: 20,
  },
  messageWrapper: {
    flexDirection: "row",
    maxWidth: "85%",
  },
  userWrapper: {
    alignSelf: "flex-end",
  },
  assistantWrapper: {
    alignSelf: "flex-start",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginTop: 4,
  },
  avatarText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: "#f4f4f4",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: "transparent",
    paddingHorizontal: 0,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  userText: {
    color: "#000",
  },
  assistantText: {
    color: "#e0e0e0",
  },
  cursor: {
    color: "#f4f4f4",
    fontWeight: "bold",
  },
  bulletsContainer: {
    marginTop: 12,
    gap: 8,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletDot: {
    color: "#666",
    fontSize: 16,
    marginTop: -2,
  },
  bulletText: {
    color: "#bbb",
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  signalsContainer: {
    marginTop: 16,
    gap: 10,
  },
  signalCard: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#222",
  },
  signalTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  signalBody: {
    color: "#888",
    fontSize: 12,
    lineHeight: 18,
  },
  followupsBar: {
    marginTop: 4,
    marginBottom: 4,
  },
  followups: {
    gap: 8,
    paddingHorizontal: 16,
    paddingRight: 16,
  },
  followupChip: {
    alignSelf: "flex-start",
    maxWidth: 220,
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#222",
    backgroundColor: "#0d0d0d",
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: "center",
  },
  followupText: {
    color: "#aaa",
    fontSize: 13,
    lineHeight: 16,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#111",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#222",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    maxHeight: 120,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: "#333",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#080808",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#111",
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 30,
    textAlign: "center",
  },
  suggestions: {
    width: "100%",
    gap: 12,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#080808",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#111",
  },
  suggestionText: {
    color: "#999",
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  errorCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#402020",
    backgroundColor: "#180909",
    padding: 14,
  },
  errorTitle: {
    color: "#f4b8b8",
    fontSize: 14,
    fontWeight: "600",
  },
  errorBody: {
    color: "#d39c9c",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
});
