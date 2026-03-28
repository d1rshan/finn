import { db, eq, notification } from "@finn/db";
import { env } from "@finn/env/server";

type SendNotificationArgs = {
  userId: string;
  channel: typeof notification.$inferInsert.channel;
  title: string;
  body: string;
  metadata?: typeof notification.$inferInsert.metadata;
};

async function deliver(args: SendNotificationArgs) {
  if (env.NOTIFICATION_PROVIDER === "webhook" && env.NOTIFICATION_WEBHOOK_URL) {
    const response = await fetch(env.NOTIFICATION_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`Notification webhook failed with status ${response.status}`);
    }

    return "webhook";
  }

  return "noop";
}

export async function sendNotification(args: SendNotificationArgs) {
  const [created] = await db
    .insert(notification)
    .values({
      id: crypto.randomUUID(),
      userId: args.userId,
      channel: args.channel,
      status: "pending",
      title: args.title,
      body: args.body,
      metadata: args.metadata ?? {},
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create notification record");
  }

  try {
    const provider = await deliver(args);
    const [updated] = await db
      .update(notification)
      .set({
        status: "sent",
        deliveredAt: new Date(),
        metadata: {
          ...(created.metadata ?? {}),
          provider,
          ...(args.metadata ?? {}),
        },
      })
      .where(eq(notification.id, created.id))
      .returning();

    return updated ?? created;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification delivery failed";
    const [updated] = await db
      .update(notification)
      .set({
        status: "failed",
        metadata: {
          ...(created.metadata ?? {}),
          ...(args.metadata ?? {}),
          error: message,
        },
      })
      .where(eq(notification.id, created.id))
      .returning();

    return updated ?? created;
  }
}
