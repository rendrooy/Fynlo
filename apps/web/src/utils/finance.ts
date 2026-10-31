import type {
  AccountInterface,
  BudgetInterface,
  BudgetPeriodInterface,
  CategoryInterface,
  TransactionInterface,
} from "@fynlo/types";

import {
  formatDayShort,
  formatMonthShort,
  monthKey,
  parseIsoDate,
  toIsoDate,
} from "./format";

const DAY_MS = 86400000;

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export type CashflowPeriod = "daily" | "monthly" | "weekly";

/** Keeps the day of the month, using the last day when a month is too short. */
function addMonths(date: Date, months: number) {
  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + months + 1,
    0,
  ).getDate();
  return new Date(
    date.getFullYear(),
    date.getMonth() + months,
    Math.min(date.getDate(), lastDay),
  );
}

export const inMonth = (transactions: TransactionInterface[], month: Date) => {
  const key = monthKey(month);
  return transactions.filter((t) => t.date.startsWith(key));
};

export const previousMonth = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth() - 1, 1);

export const touchesAccount = (t: TransactionInterface, accountId: string) =>
  t.accountId === accountId || t.toAccountId === accountId;

export function accountBalance(
  account: AccountInterface,
  transactions: TransactionInterface[],
) {
  return transactions.reduce(
    (balance, t) => balance + signedAmount(t, account.id),
    account.openingBalance,
  );
}

/** How much a transaction changes one account's balance. */
export function signedAmount(t: TransactionInterface, accountId: string) {
  if (t.toAccountId === accountId) return t.amount;
  if (t.accountId !== accountId) return 0;
  return t.type === "income" ? t.amount : -t.amount;
}

export function totals(transactions: TransactionInterface[]) {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.type === "income") income += t.amount;
    if (t.type === "expense") expense += t.amount;
  }
  return { expense, income, net: income - expense };
}

/** Excluded accounts stay visible but do not count toward totals. */
export const totalBalance = (
  accounts: AccountInterface[],
  transactions: TransactionInterface[],
) =>
  accounts
    .filter((account) => !account.isExcluded)
    .reduce((sum, account) => sum + accountBalance(account, transactions), 0);

export const accountLabel = (account?: AccountInterface) =>
  account ? `${account.name}${account.mask ? ` •• ${account.mask}` : ""}` : "";

export const sortNewestFirst = (transactions: TransactionInterface[]) =>
  [...transactions].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.time.localeCompare(a.time) ||
      b.id.localeCompare(a.id),
  );

/** The expense category that grew most against last month, with six months of history. */
export function biggestIncrease(
  categories: CategoryInterface[],
  transactions: TransactionInterface[],
  today = new Date(),
) {
  const current = spentByCategory(inMonth(transactions, today));
  const previous = spentByCategory(inMonth(transactions, previousMonth(today)));
  let best: null | { categoryId: string; difference: number } = null;
  for (const [categoryId, amount] of current) {
    const difference = amount - (previous.get(categoryId) ?? 0);
    if (difference > 0 && (!best || difference > best.difference)) {
      best = { categoryId, difference };
    }
  }
  if (!best) return null;
  const { categoryId, difference } = best;
  const before = previous.get(categoryId) ?? 0;
  return {
    difference,
    history: lastMonths(6, today).map(
      (month) =>
        spentByCategory(inMonth(transactions, month)).get(categoryId) ?? 0,
    ),
    name: categories.find((c) => c.id === categoryId)?.name ?? "Uncategorized",
    percent: before > 0 ? Math.round((difference / before) * 100) : null,
  };
}

/** Limits and spending of budgets, counting only expenses dated within the range. */
export function budgetSummary(
  budgets: BudgetInterface[],
  transactions: TransactionInterface[],
  range: { from: string; to: string },
) {
  const spentMap = spentByCategory(
    transactions.filter((t) => t.date >= range.from && t.date <= range.to),
  );
  const limit = budgets.reduce((sum, budget) => sum + budget.limit, 0);
  const spent = budgets.reduce(
    (sum, budget) => sum + (spentMap.get(budget.categoryId) ?? 0),
    0,
  );
  return { limit, remaining: limit - spent, spent, spentMap };
}

/** Income and expenses per day of this month, per week, or per month. */
export function cashflowSeries(
  transactions: TransactionInterface[],
  period: CashflowPeriod,
  today = new Date(),
) {
  if (period === "monthly") {
    return lastMonths(6, today).map((month) => ({
      ...totals(inMonth(transactions, month)),
      label: formatMonthShort(month),
    }));
  }
  if (period === "weekly") {
    return Array.from({ length: 8 }, (_, i) => {
      const end = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - (7 - i) * 7,
      );
      const start = new Date(
        end.getFullYear(),
        end.getMonth(),
        end.getDate() - 6,
      );
      const endIso = toIsoDate(end);
      return {
        ...sumBetween(transactions, toIsoDate(start), endIso),
        label: formatDayShort(endIso),
      };
    });
  }
  return Array.from({ length: today.getDate() }, (_, i) => {
    const iso = toIsoDate(
      new Date(today.getFullYear(), today.getMonth(), i + 1),
    );
    return {
      ...sumBetween(transactions, iso, iso),
      label: formatDayShort(iso),
    };
  });
}

/** Spending per category for one month, largest first, with its share of the total. */
export function expenseBreakdown(
  categories: CategoryInterface[],
  transactions: TransactionInterface[],
  period: Date | { from: string; to: string } = new Date(),
) {
  const monthItems =
    period instanceof Date
      ? inMonth(transactions, period)
      : transactions.filter(
          (t) => t.date >= period.from && t.date <= period.to,
        );
  const total = totals(monthItems).expense;
  const rows = [...spentByCategory(monthItems).entries()]
    .map(([categoryId, amount]) => {
      const category = categories.find((c) => c.id === categoryId);
      return {
        amount,
        color: category?.color ?? "#64748b",
        id: categoryId,
        name: category?.name ?? "Uncategorized",
        percent: total > 0 ? Math.round((amount / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
  return { rows, total };
}

/** Returns the first day of each of the last `count` months, oldest first. */
export function lastMonths(count: number, from = new Date()) {
  return Array.from(
    { length: count },
    (_, i) =>
      new Date(from.getFullYear(), from.getMonth() - (count - 1 - i), 1),
  );
}

/** The dates of a budget period that contain `today`, or its first dates if it hasn't started. */
export function periodRange(
  period: Pick<
    BudgetPeriodInterface,
    "endDate" | "intervalCount" | "startDate" | "unit"
  >,
  today = new Date(),
) {
  const { endDate, intervalCount, startDate, unit } = period;
  if (unit === "once") return { from: startDate, to: endDate ?? startDate };

  const start = parseIsoDate(startDate);
  const current = parseIsoDate(toIsoDate(today));
  if (unit === "day" || unit === "week") {
    const length = intervalCount * (unit === "week" ? 7 : 1);
    const elapsed = Math.round((current.getTime() - start.getTime()) / DAY_MS);
    const offset = Math.max(Math.floor(elapsed / length), 0) * length;
    return {
      from: toIsoDate(addDays(start, offset)),
      to: toIsoDate(addDays(start, offset + length - 1)),
    };
  }

  const months = intervalCount * (unit === "year" ? 12 : 1);
  const elapsed =
    (current.getFullYear() - start.getFullYear()) * 12 +
    current.getMonth() -
    start.getMonth();
  let index = Math.max(Math.floor(elapsed / months), 0);
  if (index > 0 && addMonths(start, index * months) > current) index -= 1;
  return {
    from: toIsoDate(addMonths(start, index * months)),
    to: toIsoDate(addDays(addMonths(start, (index + 1) * months), -1)),
  };
}

export function spentByCategory(transactions: TransactionInterface[]) {
  const spent = new Map<string, number>();
  for (const t of transactions) {
    if (t.type === "expense")
      spent.set(
        t.categoryId ?? "",
        (spent.get(t.categoryId ?? "") ?? 0) + t.amount,
      );
  }
  return spent;
}

export function topMerchants(transactions: TransactionInterface[], count = 4) {
  const merchants = new Map<string, number>();
  for (const t of transactions) {
    if (t.type === "expense")
      merchants.set(t.name, (merchants.get(t.name) ?? 0) + t.amount);
  }
  return [...merchants.entries()]
    .map(([name, amount]) => ({ amount, name }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, count);
}

function sumBetween(
  transactions: TransactionInterface[],
  from: string,
  to: string,
) {
  return totals(transactions.filter((t) => t.date >= from && t.date <= to));
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface DateRange {
  from: string;
  to: string;
}

export type DateRangePreset =
  | "all"
  | "custom"
  | "last-30"
  | "last-90"
  | "last-month"
  | "this-month"
  | "this-year";

/** Average spending per weekday, counted only over days that had spending. */
export function weekdayAverages(transactions: TransactionInterface[]) {
  const buckets = WEEKDAYS.map((label) => ({
    days: new Set<string>(),
    label,
    total: 0,
  }));
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const bucket = buckets[(new Date(`${t.date}T00:00:00`).getDay() + 6) % 7];
    if (!bucket) continue;
    bucket.total += t.amount;
    bucket.days.add(t.date);
  }
  return buckets.map(({ days, label, total }) => ({
    label,
    value: days.size > 0 ? total / days.size : 0,
  }));
}

const inRange = (t: TransactionInterface, { from, to }: DateRange) =>
  t.date >= from && t.date <= to;

export const transactionsInRange = (
  transactions: TransactionInterface[],
  range: DateRange,
) => transactions.filter((t) => inRange(t, range));

/** The dates of a preset, and the period to compare against. "all" has nothing to compare. */
export function resolveDateRange(
  preset: DateRangePreset,
  custom: DateRange,
  transactions: TransactionInterface[],
  today = new Date(),
): { previous: DateRange | null; range: DateRange } {
  const year = today.getFullYear();
  const month = today.getMonth();
  const iso = toIsoDate(today);
  const span = (from: Date, to: Date) => ({
    from: toIsoDate(from),
    to: toIsoDate(to),
  });
  // The same number of days, ending the day before.
  const before = ({ from, to }: DateRange) => {
    const start = parseIsoDate(from);
    const days = Math.round(
      (parseIsoDate(to).getTime() - start.getTime()) / DAY_MS,
    );
    return span(addDays(start, -days - 1), addDays(start, -1));
  };
  const lastDays = (count: number) => {
    const range = span(addDays(today, 1 - count), today);
    return { previous: before(range), range };
  };

  switch (preset) {
    case "all": {
      const dates = transactions.map((t) => t.date).sort();
      return {
        previous: null,
        range: { from: dates[0] ?? iso, to: dates.at(-1) ?? iso },
      };
    }
    case "custom": {
      // Dates entered backward still mean the same period.
      const range =
        custom.from <= custom.to
          ? custom
          : { from: custom.to, to: custom.from };
      return { previous: before(range), range };
    }
    case "last-30":
      return lastDays(30);
    case "last-90":
      return lastDays(90);
    case "last-month":
      return {
        previous: span(
          new Date(year, month - 2, 1),
          new Date(year, month - 1, 0),
        ),
        range: span(new Date(year, month - 1, 1), new Date(year, month, 0)),
      };
    case "this-month":
      return {
        previous: span(new Date(year, month - 1, 1), new Date(year, month, 0)),
        range: span(new Date(year, month, 1), new Date(year, month + 1, 0)),
      };
    case "this-year":
      return {
        previous: span(new Date(year - 1, 0, 1), new Date(year - 1, 11, 31)),
        range: span(new Date(year, 0, 1), new Date(year, 11, 31)),
      };
  }
}

const MAX_DAILY_POINTS = 186;
const MAX_WEEKLY_POINTS = 104;

/** Income and expenses across a range. Very long ranges group more coarsely to stay readable. */
export function cashflowInRange(
  transactions: TransactionInterface[],
  range: DateRange,
  period: CashflowPeriod,
  today = new Date(),
) {
  const todayIso = toIsoDate(today);
  // Days that haven't happened yet would only draw a flat line.
  const to =
    range.from <= todayIso && range.to > todayIso ? todayIso : range.to;
  const start = parseIsoDate(range.from);
  const end = parseIsoDate(to);
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const spansYears = start.getFullYear() !== end.getFullYear();

  const unit =
    period === "monthly" ||
    (period === "weekly" && days / 7 > MAX_WEEKLY_POINTS) ||
    (period === "daily" && days / 7 > MAX_WEEKLY_POINTS)
      ? "monthly"
      : period === "weekly" || days > MAX_DAILY_POINTS
        ? "weekly"
        : "daily";

  if (unit === "monthly") {
    const points = [];
    let month = new Date(start.getFullYear(), start.getMonth(), 1);
    while (month <= end) {
      const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      const from = month < start ? range.from : toIsoDate(month);
      const last = addDays(next, -1);
      points.push({
        ...sumBetween(transactions, from, last > end ? to : toIsoDate(last)),
        label: spansYears
          ? month.toLocaleDateString("en-GB", {
              month: "short",
              year: "2-digit",
            })
          : formatMonthShort(month),
      });
      month = next;
    }
    return points;
  }

  const size = unit === "weekly" ? 7 : 1;
  return Array.from({ length: Math.ceil(days / size) }, (_, index) => {
    const first = addDays(start, index * size);
    const last = addDays(first, size - 1);
    const from = toIsoDate(first);
    return {
      ...sumBetween(transactions, from, last > end ? to : toIsoDate(last)),
      label: formatDayShort(from),
    };
  });
}
