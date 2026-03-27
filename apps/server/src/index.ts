import { auth } from "@finn/auth";
import { expenseCategories } from "@finn/db";
import { env } from "@finn/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { z } from "zod";

import {
  createExpenseForUser,
  deleteExpenseForUser,
  getExpenseFeed,
  getReportDetail,
  listExpenses,
  listExpensesForRange,
  listReports,
} from "@/lib/finn";
import { requireSession } from "@/lib/auth";

const app = new Hono();
const api = new Hono();

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
