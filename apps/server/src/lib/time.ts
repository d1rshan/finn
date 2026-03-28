type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string) {
  const cached = formatterCache.get(timeZone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

export function resolveTimeZone(timeZone?: string | null) {
  if (!timeZone) {
    return "Asia/Kolkata";
  }

  try {
    getFormatter(timeZone);
    return timeZone;
  } catch {
    return "Asia/Kolkata";
  }
}

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = getFormatter(timeZone).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  const weekday = read("weekday");

  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: Number(read("hour")),
    minute: Number(read("minute")),
    weekday:
      weekday === "Mon"
        ? 1
        : weekday === "Tue"
          ? 2
          : weekday === "Wed"
            ? 3
            : weekday === "Thu"
              ? 4
              : weekday === "Fri"
                ? 5
                : weekday === "Sat"
                  ? 6
                  : 0,
  };
}

function getTimeZoneOffset(date: Date, timeZone: string) {
  const parts = getFormatter(timeZone).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((entry) => entry.type === type)?.value ?? 0);

  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    0,
  );

  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(args: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
}, timeZone: string) {
  const utcGuess = new Date(
    Date.UTC(args.year, args.month - 1, args.day, args.hour ?? 0, args.minute ?? 0, 0),
  );
  return new Date(utcGuess.getTime() - getTimeZoneOffset(utcGuess, timeZone));
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function differenceInDays(later: Date, earlier: Date) {
  return Math.round((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / 86_400_000);
}

export function startOfWeek(date: Date) {
  const start = startOfDay(date);
  const diff = start.getDay() === 0 ? -6 : 1 - start.getDay();
  return addDays(start, diff);
}

export function endOfWeek(date: Date) {
  return addDays(startOfWeek(date), 7);
}

export function monthBoundsFromNow(now: Date, monthOffset: number) {
  return {
    start: new Date(now.getFullYear(), now.getMonth() + monthOffset, 1),
    end: new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 1),
  };
}

export function zonedDayWindow(now: Date, timeZone: string, dayOffset = 0) {
  const parts = getZonedParts(now, timeZone);
  const start = zonedDateTimeToUtc(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day + dayOffset,
      hour: 0,
      minute: 0,
    },
    timeZone,
  );
  const end = zonedDateTimeToUtc(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day + dayOffset + 1,
      hour: 0,
      minute: 0,
    },
    timeZone,
  );
  return { start, end };
}

export function zonedWeekWindow(now: Date, timeZone: string, weekOffset = 0) {
  const parts = getZonedParts(now, timeZone);
  const mondayOffset = parts.weekday === 0 ? -6 : 1 - parts.weekday;
  const start = zonedDateTimeToUtc(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day + mondayOffset + weekOffset * 7,
      hour: 0,
      minute: 0,
    },
    timeZone,
  );
  const end = zonedDateTimeToUtc(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day + mondayOffset + (weekOffset + 1) * 7,
      hour: 0,
      minute: 0,
    },
    timeZone,
  );
  return { start, end };
}

export function zonedMonthWindow(now: Date, timeZone: string, monthOffset = 0) {
  const parts = getZonedParts(now, timeZone);
  const start = zonedDateTimeToUtc(
    {
      year: parts.year,
      month: parts.month + monthOffset,
      day: 1,
      hour: 0,
      minute: 0,
    },
    timeZone,
  );
  const end = zonedDateTimeToUtc(
    {
      year: parts.year,
      month: parts.month + monthOffset + 1,
      day: 1,
      hour: 0,
      minute: 0,
    },
    timeZone,
  );
  return { start, end };
}
