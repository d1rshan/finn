import { auth } from "@finn/auth";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export async function requireSession(c: Context) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    throw new HTTPException(401, {
      message: "Unauthorized",
    });
  }

  return session;
}
