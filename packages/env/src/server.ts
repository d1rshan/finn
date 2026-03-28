import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_BASE_URL: z.url().default("https://generativelanguage.googleapis.com/v1beta"),
    GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
    ENABLE_SCHEDULER: z.coerce.boolean().default(false),
    NOTIFICATION_PROVIDER: z.enum(["noop", "webhook"]).default("noop"),
    NOTIFICATION_WEBHOOK_URL: z.url().optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
