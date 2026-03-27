import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not Found" }} />
      <Container>
        <View style={styles.container}>
          <Text style={styles.eyebrow}>404</Text>
          <Text style={styles.title}>This route does not exist.</Text>
          <Text style={styles.subtitle}>
            Finn only keeps the surfaces that matter close at hand.
          </Text>
          <Link href="/" style={styles.link}>
            Back to Finn
          </Link>
        </View>
      </Container>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  eyebrow: {
    color: "#8b8b8b",
    fontSize: 12,
    letterSpacing: 2.4,
    textTransform: "uppercase",
  },
  title: {
    color: "#f7f7f7",
    fontSize: 28,
    fontWeight: "600",
    textAlign: "center",
  },
  subtitle: {
    color: "#8b8b8b",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 300,
  },
  link: {
    marginTop: 8,
    color: "#050505",
    backgroundColor: "#f4f4f4",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    overflow: "hidden",
  },
});
