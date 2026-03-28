import { db, expense, type ExpenseCategory } from "./index";

const userId = "Gm4Pofs5k0nWVDRVCjkRUqMNFtlK8Pvo";

type SeedExpense = {
  merchantName: string;
  category: ExpenseCategory;
  amountMinor: number;
  occurredAt: Date;
  note?: string;
};

function daysAgo(baseDate: Date, days: number, hours: number, minutes = 0) {
  const next = new Date(baseDate);
  next.setDate(baseDate.getDate() - days);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function dateInCurrentMonth(day: number, hours: number, minutes = 0) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), day, hours, minutes, 0, 0);
}

function formatDate(value: Date) {
  return value.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildRecurringSwiggyPattern(now: Date) {
  return [
    {
      merchantName: "Swiggy",
      category: "food" as const,
      amountMinor: 41_500,
      occurredAt: daysAgo(now, 33, 22, 10),
      note: "Recurring dinner order",
    },
    {
      merchantName: "SWIGGY LTD",
      category: "food" as const,
      amountMinor: 44_000,
      occurredAt: daysAgo(now, 26, 22, 25),
      note: "Late dinner",
    },
    {
      merchantName: "swiggy",
      category: "food" as const,
      amountMinor: 42_500,
      occurredAt: daysAgo(now, 19, 22, 40),
      note: "Post work dinner",
    },
    {
      merchantName: "Swiggy",
      category: "food" as const,
      amountMinor: 45_500,
      occurredAt: daysAgo(now, 12, 22, 5),
      note: "Weekend dinner",
    },
    {
      merchantName: "SWIGGY",
      category: "food" as const,
      amountMinor: 43_500,
      occurredAt: daysAgo(now, 5, 22, 30),
      note: "Dinner repeat",
    },
  ] satisfies SeedExpense[];
}

function buildWeekendBiasPattern(now: Date) {
  return [
    {
      merchantName: "PVR Cinemas",
      category: "entertainment" as const,
      amountMinor: 78_000,
      occurredAt: daysAgo(now, 27, 20, 0),
      note: "Saturday movie",
    },
    {
      merchantName: "Social",
      category: "food" as const,
      amountMinor: 89_000,
      occurredAt: daysAgo(now, 21, 21, 15),
      note: "Weekend dinner",
    },
    {
      merchantName: "Zomato",
      category: "food" as const,
      amountMinor: 62_000,
      occurredAt: daysAgo(now, 20, 22, 5),
      note: "Sunday late order",
    },
    {
      merchantName: "BookMyShow",
      category: "entertainment" as const,
      amountMinor: 64_000,
      occurredAt: daysAgo(now, 13, 19, 45),
      note: "Saturday show",
    },
    {
      merchantName: "Smoke House Deli",
      category: "food" as const,
      amountMinor: 93_000,
      occurredAt: daysAgo(now, 6, 21, 30),
      note: "Weekend dinner plan",
    },
    {
      merchantName: "Instamart",
      category: "groceries" as const,
      amountMinor: 28_000,
      occurredAt: daysAgo(now, 4, 11, 0),
      note: "Weekday essentials",
    },
    {
      merchantName: "Metro Card",
      category: "commute" as const,
      amountMinor: 19_000,
      occurredAt: daysAgo(now, 3, 9, 15),
      note: "Office commute",
    },
  ] satisfies SeedExpense[];
}

function buildEarlyMonthPattern() {
  return [
    {
      merchantName: "House Rent",
      category: "bills" as const,
      amountMinor: 2_400_000,
      occurredAt: dateInCurrentMonth(2, 10, 30),
      note: "Monthly rent",
    },
    {
      merchantName: "Mutual Fund SIP",
      category: "transfer" as const,
      amountMinor: 650_000,
      occurredAt: dateInCurrentMonth(3, 9, 45),
      note: "Investment auto debit",
    },
    {
      merchantName: "Tata Power",
      category: "bills" as const,
      amountMinor: 315_000,
      occurredAt: dateInCurrentMonth(4, 11, 10),
      note: "Electricity bill",
    },
  ] satisfies SeedExpense[];
}

function buildFoodDriftPattern(now: Date) {
  return [
    {
      merchantName: "Blue Tokai",
      category: "food" as const,
      amountMinor: 18_500,
      occurredAt: daysAgo(now, 68, 10, 0),
      note: "Coffee baseline",
    },
    {
      merchantName: "Subway",
      category: "food" as const,
      amountMinor: 24_000,
      occurredAt: daysAgo(now, 61, 13, 5),
      note: "Lunch baseline",
    },
    {
      merchantName: "Haldiram's",
      category: "food" as const,
      amountMinor: 21_500,
      occurredAt: daysAgo(now, 54, 20, 15),
      note: "Baseline dinner",
    },
    {
      merchantName: "Sweet Truth",
      category: "food" as const,
      amountMinor: 22_000,
      occurredAt: daysAgo(now, 48, 21, 20),
      note: "Dessert baseline",
    },
    {
      merchantName: "Third Wave Coffee",
      category: "food" as const,
      amountMinor: 36_000,
      occurredAt: daysAgo(now, 24, 10, 20),
      note: "Recent coffee run",
    },
    {
      merchantName: "McDonald's",
      category: "food" as const,
      amountMinor: 54_000,
      occurredAt: daysAgo(now, 18, 13, 10),
      note: "Recent lunch drift",
    },
    {
      merchantName: "Burma Burma",
      category: "food" as const,
      amountMinor: 87_000,
      occurredAt: daysAgo(now, 10, 20, 40),
      note: "Dinner drift",
    },
    {
      merchantName: "Zomato",
      category: "food" as const,
      amountMinor: 74_000,
      occurredAt: daysAgo(now, 7, 21, 50),
      note: "Recent order spike",
    },
    {
      merchantName: "Cafe Noir",
      category: "food" as const,
      amountMinor: 46_000,
      occurredAt: daysAgo(now, 2, 9, 35),
      note: "Recent breakfast",
    },
  ] satisfies SeedExpense[];
}

function buildUberMismatchPattern(now: Date) {
  return [
    {
      merchantName: "Uber",
      category: "commute" as const,
      amountMinor: 24_000,
      occurredAt: daysAgo(now, 42, 8, 45),
      note: "Office ride",
    },
    {
      merchantName: "UBER INDIA",
      category: "commute" as const,
      amountMinor: 27_500,
      occurredAt: daysAgo(now, 30, 9, 5),
      note: "Morning ride",
    },
    {
      merchantName: "Uber",
      category: "commute" as const,
      amountMinor: 26_000,
      occurredAt: daysAgo(now, 22, 18, 20),
      note: "Evening commute",
    },
    {
      merchantName: "Uber",
      category: "other" as const,
      amountMinor: 29_000,
      occurredAt: daysAgo(now, 9, 21, 0),
      note: "Mislabeled Uber ride",
    },
    {
      merchantName: "UBER",
      category: "other" as const,
      amountMinor: 31_000,
      occurredAt: daysAgo(now, 1, 22, 10),
      note: "Another mismatched Uber payment",
    },
  ] satisfies SeedExpense[];
}

function buildSupportingBackground(now: Date) {
  return [
    {
      merchantName: "BigBasket",
      category: "groceries" as const,
      amountMinor: 52_000,
      occurredAt: daysAgo(now, 35, 12, 30),
      note: "Groceries",
    },
    {
      merchantName: "Apollo Pharmacy",
      category: "health" as const,
      amountMinor: 17_000,
      occurredAt: daysAgo(now, 17, 18, 10),
      note: "Medicines",
    },
    {
      merchantName: "Airtel",
      category: "bills" as const,
      amountMinor: 79_900,
      occurredAt: daysAgo(now, 15, 14, 0),
      note: "Mobile recharge",
    },
    {
      merchantName: "IRCTC",
      category: "travel" as const,
      amountMinor: 125_000,
      occurredAt: daysAgo(now, 8, 16, 20),
      note: "Train booking",
    },
  ] satisfies SeedExpense[];
}

function buildPatternSeedData(now: Date) {
  return [
    ...buildRecurringSwiggyPattern(now),
    ...buildWeekendBiasPattern(now),
    ...buildEarlyMonthPattern(),
    ...buildFoodDriftPattern(now),
    ...buildUberMismatchPattern(now),
    ...buildSupportingBackground(now),
  ].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
}

async function seed() {
  const now = new Date();
  const expensesToInsert = buildPatternSeedData(now);

  console.log(`Seeding financial memory graph patterns for user: ${userId}`);
  console.log(`Prepared ${expensesToInsert.length} deterministic expenses:`);

  for (const entry of expensesToInsert) {
    console.log(
      `- ${formatDate(entry.occurredAt)} | ${entry.merchantName} | ${entry.category} | ${entry.amountMinor}`,
    );
  }

  await db.insert(expense).values(
    expensesToInsert.map((entry) => ({
      id: crypto.randomUUID(),
      userId,
      amountMinor: entry.amountMinor,
      currency: "INR",
      merchantName: entry.merchantName,
      category: entry.category,
      occurredAt: entry.occurredAt,
      note: entry.note ?? null,
    })),
  );

  console.log("Seed complete.");
  console.log("Expected memory outcomes:");
  console.log("- Swiggy recurring cadence");
  console.log("- Evening or late-night spend window");
  console.log("- Weekend spending bias");
  console.log("- Early-month salary-cycle clustering");
  console.log("- Food category drift in the recent 30-day window");
  console.log("- Uber merchant-category mismatch");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
