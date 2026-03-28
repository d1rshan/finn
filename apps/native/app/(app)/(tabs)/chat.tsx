import { useChat } from "@ai-sdk/react";
import { Ionicons } from "@expo/vector-icons";
import { DefaultChatTransport } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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

import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import { useFeedQuery } from "@/lib/finn-api";
import { env } from "@finn/env/native";

type ChatPart = {
  type?: string;
  text?: string;
};

function extractText(parts: ChatPart[]) {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

function normalizeAssistantText(rawText: string) {
  const trimmed = rawText.trim();
  if (!trimmed.startsWith("{")) {
    return rawText;
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      answer?: string;
      bullets?: string[];
    };

    const sections = [parsed.answer?.trim() ?? ""];
    if (parsed.bullets?.length) {
      sections.push("", ...parsed.bullets.map((bullet) => `- ${bullet}`));
    }

    return sections.filter(Boolean).join("\n");
  } catch {
    return rawText;
  }
}

function renderInlineMarkdown(text: string, textStyle: object, boldStyle: object) {
  const segments = text.split(/(\*\*.*?\*\*)/g);

  return segments.map((segment, index) => {
    const isBold = segment.startsWith("**") && segment.endsWith("**") && segment.length >= 4;
    const content = isBold ? segment.slice(2, -2) : segment;

    return (
      <Text key={`${content}-${index}`} style={isBold ? [textStyle, boldStyle] : textStyle}>
        {content}
      </Text>
    );
  });
}

function MarkdownMessage({
  content,
  isUser,
  isStreaming,
}: {
  content: string;
  isUser: boolean;
  isStreaming: boolean;
}) {
  const normalized = normalizeAssistantText(content);
  const lines = normalized.split("\n");
  const elements: ReactNode[] = [];
  let bulletItems: string[] = [];

  function flushBullets() {
    if (!bulletItems.length) {
      return;
    }

    elements.push(
      <View key={`bullets-${elements.length}`} style={styles.markdownBulletGroup}>
        {bulletItems.map((item, index) => (
          <View key={`${item}-${index}`} style={styles.markdownBulletRow}>
            <Text style={[styles.markdownBulletDot, isUser ? styles.userText : styles.assistantText]}>•</Text>
            <Text style={[styles.markdownText, isUser ? styles.userText : styles.assistantText]}>
              {renderInlineMarkdown(item, styles.markdownText, styles.markdownBold)}
            </Text>
          </View>
        ))}
      </View>,
    );

    bulletItems = [];
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushBullets();
      return;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      bulletItems.push(bulletMatch[1] ?? "");
      return;
    }

    flushBullets();

    if (trimmed.startsWith("### ")) {
      elements.push(
        <Text key={`h3-${index}`} style={[styles.markdownHeadingSmall, isUser ? styles.userText : styles.assistantText]}>
          {renderInlineMarkdown(trimmed.slice(4), styles.markdownHeadingSmall, styles.markdownBold)}
        </Text>,
      );
      return;
    }

    if (trimmed.startsWith("## ")) {
      elements.push(
        <Text key={`h2-${index}`} style={[styles.markdownHeadingMedium, isUser ? styles.userText : styles.assistantText]}>
          {renderInlineMarkdown(trimmed.slice(3), styles.markdownHeadingMedium, styles.markdownBold)}
        </Text>,
      );
      return;
    }

    if (trimmed.startsWith("# ")) {
      elements.push(
        <Text key={`h1-${index}`} style={[styles.markdownHeadingLarge, isUser ? styles.userText : styles.assistantText]}>
          {renderInlineMarkdown(trimmed.slice(2), styles.markdownHeadingLarge, styles.markdownBold)}
        </Text>,
      );
      return;
    }

    elements.push(
      <Text key={`p-${index}`} style={[styles.markdownText, isUser ? styles.userText : styles.assistantText]}>
        {renderInlineMarkdown(trimmed, styles.markdownText, styles.markdownBold)}
      </Text>,
    );
  });

  flushBullets();

  return (
    <View style={styles.markdownBlock}>
      {elements.map((element, index) => (
        <Fragment key={index}>{element}</Fragment>
      ))}
      {isStreaming ? <Text style={[styles.cursor, isUser ? styles.userText : styles.assistantText]}>|</Text> : null}
    </View>
  );
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
    onError: (streamError) => {
      console.error(streamError, "Finn chat error");
    },
  });

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, status]);

  const isStreaming = status === "submitted" || status === "streaming";
  const suggestedQuestions = feedQuery.data?.suggestedQuestions ?? [];

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
                const parts = message.parts as ChatPart[];
                const text = extractText(parts);
                const isLatestAssistant = !isUser && index === messages.length - 1 && isStreaming;

                if (!text.trim() && !isLatestAssistant) {
                  return null;
                }

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
                      <MarkdownMessage content={text} isUser={isUser} isStreaming={isLatestAssistant} />
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
  userText: {
    color: "#000",
  },
  assistantText: {
    color: "#e0e0e0",
  },
  markdownBlock: {
    gap: 8,
  },
  markdownText: {
    fontSize: 16,
    lineHeight: 24,
  },
  markdownBold: {
    fontWeight: "700",
  },
  markdownHeadingLarge: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
  },
  markdownHeadingMedium: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700",
  },
  markdownHeadingSmall: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
  },
  markdownBulletGroup: {
    gap: 6,
  },
  markdownBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  markdownBulletDot: {
    fontSize: 16,
    lineHeight: 24,
  },
  cursor: {
    fontWeight: "bold",
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
