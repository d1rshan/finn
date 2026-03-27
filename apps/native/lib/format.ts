import type {
  AnalyticsCategoryBreakdown,
  ExpenseCategory,
  ReportMetric,
  ReportPeriodType,
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

export function formatPeriodType(periodType: ReportPeriodType) {
  return periodType === "weekly" ? "Weekly report" : "Monthly report";
}

export function formatMetricValue(metric: ReportMetric) {
  if (metric.label === "Transactions") {
    return `${metric.value}`;
  }

  if (metric.change === null || metric.change === undefined) {
    return formatCurrency(metric.value);
  }

  const changePrefix = metric.change > 0 ? "+" : "";
  return `${formatCurrency(metric.value)} (${changePrefix}${metric.change}%)`;
}

export function formatAnalyticsCategory(category: AnalyticsCategoryBreakdown["category"]) {
  if (category === "other") {
    return "Other";
  }

  return formatCategory(category);
}
