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
  month = new Date(),
) {
  const monthItems = inMonth(transactions, month);
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
