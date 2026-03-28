import { Redirect, Stack, type Href } from "expo-router";

import { authClient } from "@/lib/auth-client";

export default function AppLayout() {
  const session = authClient.useSession();

  if (session.isPending) {
    return null;
  }

  if (!session.data?.user) {
    return <Redirect href={"/(auth)" as Href} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
