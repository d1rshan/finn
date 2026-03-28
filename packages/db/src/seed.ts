import { db, expense, type ExpenseCategory } from "./index";

const userId = "Gm4Pofs5k0nWVDRVCjkRUqMNFtlK8Pvo";

const merchants: Array<{ name: string; category: ExpenseCategory; min: number; max: number; frequency: number }> = [
  { name: "Starbucks", category: "food", min: 35000, max: 75000, frequency: 0.4 },
  { name: "Swiggy", category: "food", min: 25000, max: 120000, frequency: 0.3 },
  { name: "Uber", category: "commute", min: 15000, max: 60000, frequency: 0.5 },
  { name: "Amazon", category: "shopping", min: 50000, max: 500000, frequency: 0.1 },
  { name: "Whole Foods", category: "groceries", min: 120000, max: 450000, frequency: 0.15 },
  { name: "Netflix", category: "bills", min: 64900, max: 64900, frequency: 0.033 }, // approx once a month
  { name: "Spotify", category: "bills", min: 11900, max: 11900, frequency: 0.033 },
  { name: "Electricity Bill", category: "bills", min: 250000, max: 450000, frequency: 0.033 },
  { name: "Movie Theater", category: "entertainment", min: 45000, max: 95000, frequency: 0.05 },
  { name: "Transfer to Savings", category: "transfer", min: 1000000, max: 2500000, frequency: 0.033 },
  { name: "Zomato", category: "food", min: 30000, max: 150000, frequency: 0.2 },
  { name: "H&M", category: "shopping", min: 199900, max: 599900, frequency: 0.05 },
  { name: "Gym Membership", category: "health", min: 350000, max: 350000, frequency: 0.033 },
  { name: "Shell Gas Station", category: "commute", min: 250000, max: 450000, frequency: 0.1 },
  { name: "Local Pharmacy", category: "health", min: 50000, max: 250000, frequency: 0.05 },
];

async function seed() {
  console.log("Seeding data for user:", userId);

  // Optional: clear existing expenses for this user to avoid duplicates if re-running
  // await db.delete(expense).where(eq(expense.userId, userId));

  const expensesToInsert = [];
  const now = new Date();
  
  // Seed for 90 days
  for (let i = 0; i < 90; i++) {
    const currentDate = new Date(now);
    currentDate.setDate(now.getDate() - i);
    
    // For each day, try to add some expenses based on frequency
    for (const merchant of merchants) {
      if (Math.random() < merchant.frequency) {
        // Randomize time of day
        const expenseDate = new Date(currentDate);
        expenseDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));

        expensesToInsert.push({
          id: crypto.randomUUID(),
          userId,
          amountMinor: Math.floor(Math.random() * (merchant.max - merchant.min + 1) + merchant.min),
          currency: "INR",
          merchantName: merchant.name,
          category: merchant.category,
          occurredAt: expenseDate,
          note: Math.random() > 0.8 ? "Mock seeded expense" : null,
        });
      }
    }
  }

  console.log(`Inserting ${expensesToInsert.length} expenses...`);
  
  // Insert in batches of 50 to avoid any limits
  const batchSize = 50;
  for (let i = 0; i < expensesToInsert.length; i += batchSize) {
    const batch = expensesToInsert.slice(i, i + batchSize);
    await db.insert(expense).values(batch);
  }

  console.log("Seed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
