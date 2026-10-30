import type { Account, Transaction } from '../types'
import { monthKey } from './format'

export const inMonth = (transactions: Transaction[], month: Date) => {
  const key = monthKey(month)
  return transactions.filter((t) => t.date.startsWith(key))
}

export function totals(transactions: Transaction[]) {
  let income = 0
  let expense = 0
  for (const t of transactions) {
    if (t.type === 'income') income += t.amount
    else expense += t.amount
  }
  return { income, expense }
}

export function accountBalance(account: Account, transactions: Transaction[]) {
  return transactions
    .filter((t) => t.accountId === account.id)
    .reduce(
      (balance, t) => balance + (t.type === 'income' ? t.amount : -t.amount),
      account.openingBalance,
    )
}

export const totalBalance = (accounts: Account[], transactions: Transaction[]) =>
  accounts.reduce((sum, account) => sum + accountBalance(account, transactions), 0)

export function spentByCategory(transactions: Transaction[]) {
  const spent = new Map<string, number>()
  for (const t of transactions) {
    if (t.type === 'expense') spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) + t.amount)
  }
  return spent
}

/** Mengembalikan Date awal bulan untuk `count` bulan terakhir, dari terlama ke terbaru. */
export function lastMonths(count: number, from = new Date()) {
  return Array.from(
    { length: count },
    (_, i) => new Date(from.getFullYear(), from.getMonth() - (count - 1 - i), 1),
  )
}

/** Mengelompokkan transaksi per tanggal, dari yang terbaru. */
export function groupByDate(transactions: Transaction[]) {
  const groups = new Map<string, Transaction[]>()
  for (const t of sortNewestFirst(transactions)) {
    groups.set(t.date, [...(groups.get(t.date) ?? []), t])
  }
  return [...groups.entries()]
}

export const sortNewestFirst = (transactions: Transaction[]) =>
  [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
