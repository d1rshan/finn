import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { auth } from "@finn/auth";
import { expenseCategories } from "@finn/db";
import { env } from "@finn/env/server";
import {
  consumeStream,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { z } from "zod";

import { answerMoneyQuestion } from "@/lib/analytics";
import { requireSession } from "@/lib/auth";
import {
  askMoneyQuestion,
  buildAskMoneyContext,
  createExpenseForUser,
  deleteExpenseForUser,
  getAnalytics,
  getExpenseFeed,
  getReportDetail,
  listExpenses,
  listExpensesForRange,
  listReports,
} from "@/lib/finn";
import { buildFinnChatContext, buildFinnSystemPrompt } from "@/lib/gemini";

const app = new Hono();
const api = new Hono();

const google = createGoogleGenerativeAI({
  apiKey: env.GEMINI_API_KEY,
  baseURL: env.GEMINI_BASE_URL,
});

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

const createExpenseSchema = z.object({
  amountMinor: z.number().int().positive(),
  merchantName: z.string().trim().min(2).max(80),
  category: z.enum(expenseCategories),
  occurredAt: z.coerce.date(),
  note: z.string().trim().max(140).optional(),
});

const askMoneySchema = z.object({
  question: z.string().trim().min(4).max(240),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(600),
      }),
    )
    .max(16)
    .default([]),
});

const analyticsPeriodSchema = z.enum(["weekly", "monthly"]).default("weekly");

const chatSchema = z.object({
  messages: z.array(z.any()).default([]),
});

function extractMessageText(message: unknown) {
  if (!message || typeof message !== "object") {
    return "";
  }

  const parts = "parts" in message && Array.isArray(message.parts) ? message.parts : [];

  return parts
    .map((part) => {
      if (!part || typeof part !== "object" || !("type" in part)) {
        return "";
      }

      if (part.type === "text" && "text" in part && typeof part.text === "string") {
        return part.text;
      }

      return "";
    })
    .join("")
    .trim();
}

function buildConversationHistory(messages: unknown[]) {
  return messages
    .map((message) => {
      if (!message || typeof message !== "object" || !("role" in message)) {
        return null;
      }

      const role = message.role;
      if (role !== "user" && role !== "assistant") {
        return null;
      }

      const content = extractMessageText(message);
      if (!content) {
        return null;
      }

      return { role, content };
    })
    .filter((entry): entry is { role: "user" | "assistant"; content: string } => entry !== null);
}

function sanitizeMessagesForModel(messages: unknown[]) {
  return messages
    .map((message) => {
      if (!message || typeof message !== "object" || !("role" in message)) {
        return null;
      }

      const role = message.role;
      if (role !== "user" && role !== "assistant" && role !== "system") {
        return null;
      }

      const content = extractMessageText(message);
      if (!content) {
        return null;
      }

      return {
        role,
        parts: [{ type: "text" as const, text: content }],
      };
    })
    .filter((entry): entry is { role: "system" | "user" | "assistant"; parts: [{ type: "text"; text: string }] } => entry !== null);
}

api.get("/feed", async (c) => {
  const session = await requireSession(c);
  const payload = await getExpenseFeed(session.user.id);

  return c.json(payload);
});

api.get("/expenses", async (c) => {
  const session = await requireSession(c);
  const payload = await listExpenses(session.user.id);

  return c.json({
    expenses: payload,
  });
});

api.post("/expenses", async (c) => {
  const session = await requireSession(c);
  const payload = createExpenseSchema.parse(await c.req.json());
  const createdExpense = await createExpenseForUser({
    ...payload,
    userId: session.user.id,
  });

  return c.json(
    {
      expense: createdExpense,
    },
    201,
  );
});

api.delete("/expenses/:expenseId", async (c) => {
  const session = await requireSession(c);
  const deletedExpense = await deleteExpenseForUser(session.user.id, c.req.param("expenseId"));

  if (!deletedExpense) {
    throw new HTTPException(404, {
      message: "Expense not found",
    });
  }

  return c.json({
    expense: deletedExpense,
  });
});

api.get("/reports", async (c) => {
  const session = await requireSession(c);
  const payload = await listReports(session.user.id);

  return c.json({
    reports: payload,
  });
});

api.get("/analytics", async (c) => {
  const session = await requireSession(c);
  const period = analyticsPeriodSchema.parse(c.req.query("period"));
  const payload = await getAnalytics(session.user.id, period);

  return c.json(payload);
});

api.get("/reports/:reportId", async (c) => {
  const session = await requireSession(c);
  const selectedReport = await getReportDetail(session.user.id, c.req.param("reportId"));

  if (!selectedReport) {
    throw new HTTPException(404, {
      message: "Report not found",
    });
  }

  const expensesForReport = await listExpensesForRange({
    userId: session.user.id,
    periodStart: selectedReport.periodStart,
    periodEnd: selectedReport.periodEnd,
  });

  return c.json({
    report: selectedReport,
    expenses: expensesForReport,
  });
});

api.post("/ask", async (c) => {
  const session = await requireSession(c);
  const payload = askMoneySchema.parse(await c.req.json());
  const answer = await askMoneyQuestion(session.user.id, payload.question, payload.history);

  return c.json(answer);
});

api.post("/chat", async (c) => {
  const session = await requireSession(c);
  const payload = chatSchema.parse(await c.req.json());
  const uiMessages = payload.messages;
  const modelMessages = sanitizeMessagesForModel(uiMessages);
  const history = buildConversationHistory(uiMessages);
  const lastUserQuestion = [...history].reverse().find((entry) => entry.role === "user")?.content;

  if (!lastUserQuestion || lastUserQuestion.trim().length < 4) {
    throw new HTTPException(400, { message: "A user question is required." });
  }

  const { currentExpenses, previousExpenses, snapshot } = await buildAskMoneyContext(session.user.id);

  if (!env.GEMINI_API_KEY) {
    const fallback = answerMoneyQuestion({
      question: lastUserQuestion,
      currentExpenses,
      previousExpenses,
      snapshot,
    });

    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        originalMessages: uiMessages,
        execute: ({ writer }) => {
          const textId = crypto.randomUUID();
          writer.write({ type: "text-start", id: textId });
          writer.write({ type: "text-delta", id: textId, delta: fallback.answer });
          writer.write({ type: "text-end", id: textId });
        },
      }),
    });
  }

  const result = streamText({
    model: google(env.GEMINI_MODEL),
    system: [
      buildFinnSystemPrompt(),
      `Finance context:\n${JSON.stringify(
        buildFinnChatContext({
          question: lastUserQuestion,
          currentExpenses,
          previousExpenses,
          snapshot,
          history,
        }),
      )}`,
      "Respond with assistant text only.",
      "Use clean markdown when it helps: short headings, bullet lists, and short paragraphs.",
      "Do not return JSON or quote the context blob.",
    ].join("\n\n"),
    messages: await convertToModelMessages(modelMessages),
    temperature: 0.4,
  });

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages: uiMessages,
      async execute({ writer }) {
        writer.merge(result.toUIMessageStream());
      },
    }),
    consumeSseStream: consumeStream,
  });
});

app.route("/api", api);

app.get("/", (c) => {
  return c.text("OK");
});

import { serve } from "@hono/node-server";

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
