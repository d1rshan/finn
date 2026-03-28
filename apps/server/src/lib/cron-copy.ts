import { env } from "@finn/env/server";
import type { InsightSummary } from "@finn/db";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

function formatInr(amountMinor: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

async function generateText(prompt: Record<string, unknown>) {
  if (!env.GEMINI_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(`${env.GEMINI_BASE_URL}/models/${env.GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify(prompt) }],
          },
        ],
        generationConfig: {
          temperature: 0.5,
          topP: 0.9,
        },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as GeminiResponse;
    return payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() || null;
  } catch {
    return null;
  }
}

export async function writeMorningBriefing(args: {
  yesterdayTotalMinor: number;
  yesterdayCount: number;
  topMerchant?: string | null;
  insights: InsightSummary[];
}) {
  const fallback = args.yesterdayCount
    ? `Yesterday you spent ${formatInr(args.yesterdayTotalMinor)} across ${args.yesterdayCount} payments${args.topMerchant ? `, led by ${args.topMerchant}` : ""}. ${args.insights[0]?.summary ?? "Finn is watching for the next useful pattern."}`
    : `No expenses landed yesterday. ${args.insights[0]?.summary ?? "Finn is still tracking your rhythm for the next useful signal."}`;

  const generated = await generateText({
    task: "Write a two-sentence personal finance morning briefing.",
    instructions: ["Exactly two sentences.", "Be direct and specific.", "Use INR formatting when amounts appear."],
    context: {
      yesterdayTotal: formatInr(args.yesterdayTotalMinor),
      transactionCount: args.yesterdayCount,
      topMerchant: args.topMerchant ?? null,
      activeInsights: args.insights.slice(0, 4),
    },
  });

  return generated || fallback;
}

export async function writeNarrative(args: {
  title: string;
  style: "weekly" | "monthly" | "push";
  metrics: Record<string, unknown>;
  insights: InsightSummary[];
}) {
  const fallback =
    args.style === "push"
      ? `${args.title}. ${args.insights[0]?.summary ?? "Finn found a new pattern worth checking."}`
      : `${args.title} surfaces the clearest pattern from this period. ${args.insights[0]?.summary ?? "Your latest spend mix and timing are now reflected in Finn."}`;

  const generated = await generateText({
    task: args.style === "push" ? "Write a short push notification body." : "Write a short finance narrative.",
    instructions:
      args.style === "push"
        ? ["Write exactly two sentences.", "Make it notification-friendly.", "Use only the supplied data."]
        : ["Write three to four sentences.", "Use only the supplied data.", "Avoid fluff and generic advice."],
    context: {
      title: args.title,
      metrics: args.metrics,
      activeInsights: args.insights.slice(0, 4),
    },
  });

  return generated || fallback;
}
