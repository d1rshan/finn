import type {
  AnalyticsCategoryBreakdown,
  ExpenseCategory,
  MemoryFactKind,
  MemoryNodeType,
} from "@/lib/finn-types";

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

export function formatCategory(category: ExpenseCategory) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function formatAnalyticsCategory(category: AnalyticsCategoryBreakdown["category"]) {
  if (category === "other") {
    return "Other";
  }

  return formatCategory(category);
}

export function formatMemoryFactKind(kind: MemoryFactKind) {
  return kind
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatMemoryNodeType(type: MemoryNodeType) {
  return type
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
