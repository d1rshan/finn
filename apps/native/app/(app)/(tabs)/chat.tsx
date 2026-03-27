import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Container } from "@/components/container";
import { useFeedQuery } from "@/lib/finn-api";
import { env } from "@finn/env/native";
import { authClient } from "@/lib/auth-client";

// Simple fallback if TextDecoder is missing in older environments
const decoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : {
  decode: (v: Uint8Array) => String.fromCharCode(...v)
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  bullets?: string[];
  suggestions?: string[];
  supportingSignals?: Array<{
    key: string;
    title: string;
    summary: string;
    severity: "low" | "medium" | "high";
  }>;
};

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const feedQuery = useFeedQuery();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const suggestedQuestions =
    lastMessage?.suggestions?.length ? lastMessage.suggestions : (feedQuery.data?.suggestedQuestions ?? []);

  function buildHistory(msgs: ChatMessage[]) {
    return msgs
      .filter((m) => !m.isStreaming && m.content.trim().length > 0)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));
  }

  async function sendQuestion(question: string) {
    const trimmed = question.trim();
    if (trimmed.length < 4 || isStreaming) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    setIsStreaming(true);

    const assistantMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantMessageId, role: "assistant", content: "", isStreaming: true },
    ]);

    try {
      const cookie = authClient.getCookie();
      const url = `${env.EXPO_PUBLIC_SERVER_URL}/api/ask/stream`;

      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.setRequestHeader("Content-Type", "application/json");
      if (cookie) {
        xhr.setRequestHeader("cookie", cookie);
      }

      let lastLength = 0;

      xhr.onreadystatechange = () => {
        // readyState 3 is "LOADING", which means we have partial data
        if (xhr.readyState === 3 || xhr.readyState === 4) {
          const currentText = xhr.responseText;
          if (currentText.length > lastLength) {
            processContent(currentText, assistantMessageId);
            lastLength = currentText.length;
          }
        }

        if (xhr.readyState === 4) {
          setIsStreaming(false);
          if (xhr.status !== 200) {
            console.error("XHR failed", xhr.status, xhr.responseText);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: "Sorry, I encountered an error. Please try again.", isStreaming: false }
                  : msg,
              ),
            );
          }
        }
      };

      xhr.onerror = () => {
        setIsStreaming(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: "Network error. Please check your connection.", isStreaming: false }
              : msg,
          ),
        );
      };

      xhr.send(JSON.stringify({
        question: trimmed,
        history: buildHistory(messages),
      }));

    } catch (error) {
      console.error("Setup error:", error);
      setIsStreaming(false);
    }
    }
  function processContent(fullContent: string, assistantMessageId: string) {
    if (fullContent.includes("__FINN_DATA__")) {
      const [text, dataStr] = fullContent.split("__FINN_DATA__");
      try {
        const data = JSON.parse(dataStr);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: text.trim(),
                  bullets: data.bullets,
                  suggestions: data.suggestions,
                  supportingSignals: data.supportingSignals,
                  isStreaming: false,
                }
              : msg,
          ),
        );
      } catch (e) {
        // Partial data, keep streaming text
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, content: text.trim() } : msg,
          ),
        );
      }
    } else {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, content: fullContent } : msg,
        ),
      );
    }
  }

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isStreaming]);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.messageWrapper, isUser ? styles.userWrapper : styles.assistantWrapper]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>F</Text>
          </View>
        )}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
            {item.content}
            {item.isStreaming && <Text style={styles.cursor}>|</Text>}
          </Text>

          {item.bullets && item.bullets.length > 0 && (
            <View style={styles.bulletsContainer}>
              {item.bullets.map((bullet, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          )}

          {item.supportingSignals && item.supportingSignals.length > 0 && (
            <View style={styles.signalsContainer}>
              {item.supportingSignals.map((signal) => (
                <View key={signal.key} style={styles.signalCard}>
                  <Text style={styles.signalTitle}>{signal.title}</Text>
                  <Text style={styles.signalBody}>{signal.summary}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <Container>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ask Finn</Text>
          <Text style={styles.headerSubtitle}>Personal Finance Analyst</Text>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: messages.length === 0 ? 0 : 20 },
          ]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles-outline" size={40} color="#333" />
              </View>
              <Text style={styles.emptyTitle}>How can I help you today?</Text>
              <View style={styles.suggestions}>
                {suggestedQuestions.map((q) => (
                  <Pressable key={q} style={styles.suggestionItem} onPress={() => sendQuestion(q)}>
                    <Text style={styles.suggestionText}>{q}</Text>
                    <Ionicons name="arrow-forward" size={14} color="#666" />
                  </Pressable>
                ))}
              </View>
            </View>
          }
        />

        <View style={[styles.inputContainer, { marginBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Ask anything..."
              placeholderTextColor="#666"
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={500}
            />
            <Pressable
              style={[styles.sendButton, (!draft.trim() || isStreaming) && styles.sendButtonDisabled]}
              onPress={() => sendQuestion(draft)}
              disabled={!draft.trim() || isStreaming}
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
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  messageWrapper: {
    flexDirection: "row",
    marginBottom: 20,
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
});
