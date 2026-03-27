import { useState } from "react";
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

import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";

function getMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const value = error.message;
    if (typeof value === "string") {
      return value;
    }
  }

  return fallback;
}

export default function AuthScreen() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === "sign-in") {
        await authClient.signIn.email(
          {
            email: email.trim(),
            password,
          },
          {
            onError(context) {
              setError(context.error?.message ?? "Failed to sign in");
            },
          },
        );
      } else {
        await authClient.signUp.email(
          {
            name: name.trim(),
            email: email.trim(),
            password,
          },
          {
            onError(context) {
              setError(context.error?.message ?? "Failed to create account");
            },
          },
        );
      }
    } catch (caughtError) {
      setError(getMessage(caughtError, "Something went wrong"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const isCreateMode = mode === "sign-up";

  return (
    <Container>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>FINN</Text>
            <Text style={styles.title}>An always-on layer for your money.</Text>
            <Text style={styles.subtitle}>
              Log the payment. Finn keeps the memory, watches the pattern, and tells you when
              something matters.
            </Text>
          </View>

          <View style={styles.modeRow}>
            <Pressable
              onPress={() => setMode("sign-in")}
              style={[styles.modeButton, mode === "sign-in" && styles.modeButtonActive]}
            >
              <Text style={[styles.modeLabel, mode === "sign-in" && styles.modeLabelActive]}>
                Sign in
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("sign-up")}
              style={[styles.modeButton, mode === "sign-up" && styles.modeButtonActive]}
            >
              <Text style={[styles.modeLabel, mode === "sign-up" && styles.modeLabelActive]}>
                Create account
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            {isCreateMode ? (
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Name"
                placeholderTextColor="#5f5f5f"
                autoCapitalize="words"
              />
            ) : null}

            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#5f5f5f"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#5f5f5f"
              secureTextEntry
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable onPress={handleSubmit} style={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="#050505" />
              ) : (
                <Text style={styles.submitLabel}>
                  {isCreateMode ? "Create Finn account" : "Enter Finn"}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
    justifyContent: "space-between",
    gap: 24,
  },
  hero: {
    gap: 14,
  },
  eyebrow: {
    color: "#7b7b7b",
    fontSize: 12,
    letterSpacing: 2.8,
    textTransform: "uppercase",
  },
  title: {
    color: "#f7f7f7",
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "600",
    maxWidth: 320,
  },
  subtitle: {
    color: "#959595",
    fontSize: 15,
    lineHeight: 24,
    maxWidth: 320,
  },
  modeRow: {
    flexDirection: "row",
    backgroundColor: "#0d0d0d",
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: "#171717",
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 999,
  },
  modeButtonActive: {
    backgroundColor: "#f4f4f4",
  },
  modeLabel: {
    color: "#8b8b8b",
    fontSize: 14,
    fontWeight: "600",
  },
  modeLabelActive: {
    color: "#050505",
  },
  card: {
    gap: 12,
    padding: 18,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    backgroundColor: "#0a0a0a",
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
  error: {
    color: "#f1c0c0",
    fontSize: 13,
  },
  submitButton: {
    marginTop: 4,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "#f4f4f4",
  },
  submitLabel: {
    color: "#050505",
    fontSize: 15,
    fontWeight: "700",
  },
});
