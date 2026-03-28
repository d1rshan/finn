import type { AnalyticsCategoryBreakdown, ExpenseCategory } from "@/lib/finn-types";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function formatCurrency(amountMinor: number) {
  return currencyFormatter.format(amountMinor / 100);
}

export function formatDateTime(value: Date | string) {
  return dateTimeFormatter.format(new Date(value));
}

export function formatDate(value: Date | string) {
  return dateFormatter.format(new Date(value));
}

export function formatCategory(category: ExpenseCategory) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function formatAnalyticsCategory(category: AnalyticsCategoryBreakdown["category"]) {
  if (category === "other") {
    return "Other";
  }

  return formatCategory(category);
}
