import { env } from "@finn/env/server";
import type { InsightSummary } from "@finn/db";

import type { AnalyticsSnapshot, ExpenseLike } from "@/lib/analytics";

type AskFinnLlmArgs = {
  question: string;
  snapshot: AnalyticsSnapshot;
  currentExpenses: ExpenseLike[];
  previousExpenses: ExpenseLike[];
  history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

type GlmResponse = {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
    };
  }>;
};

function formatCurrency(amountMinor: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

function summarizeExpenses(expenses: ExpenseLike[]) {
  return expenses
    .slice(0, 12)
    .map((entry) => ({
      merchant: entry.merchantName,
      category: entry.category,
      amount: formatCurrency(entry.amountMinor),
      occurredAt: entry.occurredAt.toISOString(),
      note: entry.note ?? undefined,
    }));
}

function summarizeSignals(signals: InsightSummary[]) {
  return signals.map((entry) => ({
    title: entry.title,
    summary: entry.summary,
    severity: entry.severity,
  }));
}

function extractContent(payload: GlmResponse) {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((entry) => entry.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
}

export async function askFinnWithGlm(args: AskFinnLlmArgs): Promise<string | null> {
  if (!env.GLM_API_KEY) {
    return null;
  }

  const response = await fetch(`${env.GLM_API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.GLM_MODEL,
      temperature: 0.4,
      top_p: 0.85,
      messages: [
        {
          role: "system",
          content:
            "You are Finn, a personal finance analyst. Answer only from the supplied analytics, chat history, and transactions. Be specific, concise, and avoid making claims not supported by the data. If the data is insufficient, say so plainly. Use INR formatting where relevant. Do not mention being an AI model. Keep answers crisp and decision-useful.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Answer the user's money question in plain language.",
            answer_shape: {
              instructions: [
                "Return exactly JSON.",
                "Keys: answer, bullets, suggestions, supportingSignalTitles.",
                "answer must be a short paragraph, under 90 words.",
                "bullets must be an array of 1 to 3 sharp factual points grounded in the supplied data.",
                "suggestions must be an array of 3 short follow-up questions.",
                "supportingSignalTitles must be an array of titles taken from the provided signals only.",
                "Do not hedge unnecessarily. Do not fabricate numbers or causes. If evidence is thin, say what is missing.",
              ],
            },
            conversationHistory: args.history.slice(-8),
            question: args.question,
            analytics: {
              persona: args.snapshot.persona,
              metrics: args.snapshot.metrics,
              behavioralSignals: summarizeSignals(args.snapshot.behavioralSignals),
              projections: args.snapshot.projections.map((entry) => ({
                category: entry.category,
                projectedAmount: formatCurrency(entry.projectedAmountMinor),
                baselineAmount: formatCurrency(entry.baselineAmountMinor),
                deltaAmount: formatCurrency(entry.deltaMinor),
              })),
              recurringCharges: args.snapshot.recurringCharges.map((entry) => ({
                merchant: entry.merchantName,
                category: entry.category,
                amount: formatCurrency(entry.amountMinor),
                cadenceDays: entry.cadenceDays,
                lastChargedAt: entry.lastChargedAt,
              })),
              unusualSilence: args.snapshot.unusualSilence,
              emotionalSpendingFingerprint: args.snapshot.emotionalSpendingFingerprint,
              endOfMonthCrunch: args.snapshot.endOfMonthCrunch,
              guiltIndex: args.snapshot.guiltIndex,
            },
            recentTransactions: {
              currentWindow: summarizeExpenses(args.currentExpenses),
              previousWindow: summarizeExpenses(args.previousExpenses),
            },
          }),
        },
      ],
      response_format: {
        type: "json_object",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`GLM request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as GlmResponse;
  const content = extractContent(payload);
  return content || null;
}
