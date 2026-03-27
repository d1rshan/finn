import { Redirect, type Href } from "expo-router";

import { authClient } from "@/lib/auth-client";

export default function IndexScreen() {
  const session = authClient.useSession();

  if (session.isPending) {
    return null;
  }

  return (
    <Redirect href={(session.data?.user ? "/(app)/(tabs)" : "/(auth)") as Href} />
  );
}
