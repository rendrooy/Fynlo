import { toIsoDate } from '../lib/format'
import type { Account, Budget, Category, Transaction, TransactionType } from '../types'

export const accounts: Account[] = [
  { id: 'bca', name: 'BCA', kind: 'bank', openingBalance: 9_500_000 },
  { id: 'gopay', name: 'GoPay', kind: 'ewallet', openingBalance: 450_000 },
  { id: 'cash', name: 'Tunai', kind: 'cash', openingBalance: 600_000 },
]

export const categories: Category[] = [
  { id: 'salary', name: 'Gaji', type: 'income', icon: 'wallet' },
  { id: 'freelance', name: 'Freelance', type: 'income', icon: 'laptop' },
  { id: 'food', name: 'Makanan', type: 'expense', icon: 'utensils' },
  { id: 'transport', name: 'Transportasi', type: 'expense', icon: 'car' },
  { id: 'housing', name: 'Tempat tinggal', type: 'expense', icon: 'home' },
  { id: 'bills', name: 'Tagihan', type: 'expense', icon: 'receipt' },
  { id: 'shopping', name: 'Belanja', type: 'expense', icon: 'bag' },
  { id: 'fun', name: 'Hiburan', type: 'expense', icon: 'film' },
]

export const budgets: Budget[] = [
  { categoryId: 'food', limit: 2_000_000 },
  { categoryId: 'transport', limit: 600_000 },
  { categoryId: 'bills', limit: 800_000 },
  { categoryId: 'shopping', limit: 700_000 },
  { categoryId: 'fun', limit: 400_000 },
]

type Row = [
  day: number,
  type: TransactionType,
  amount: number,
  categoryId: string,
  accountId: string,
  note: string,
]

const monthlyRows: Row[] = [
  [1, 'income', 8_500_000, 'salary', 'bca', 'Gaji bulanan'],
  [1, 'expense', 2_200_000, 'housing', 'bca', 'Sewa kos'],
  [2, 'expense', 85_000, 'food', 'gopay', 'Makan siang'],
  [3, 'expense', 450_000, 'bills', 'bca', 'Listrik'],
  [4, 'expense', 120_000, 'transport', 'gopay', 'Ojek online'],
  [5, 'expense', 340_000, 'food', 'bca', 'Belanja dapur'],
  [7, 'expense', 275_000, 'bills', 'bca', 'Internet rumah'],
  [8, 'expense', 65_000, 'fun', 'gopay', 'Langganan musik'],
  [10, 'expense', 410_000, 'shopping', 'bca', 'Sepatu'],
  [12, 'expense', 150_000, 'transport', 'cash', 'Bensin'],
  [14, 'income', 1_500_000, 'freelance', 'bca', 'Proyek desain'],
  [15, 'expense', 410_000, 'food', 'bca', 'Belanja bulanan'],
  [17, 'expense', 180_000, 'fun', 'bca', 'Nonton bioskop'],
  [19, 'expense', 95_000, 'food', 'cash', 'Makan malam'],
  [22, 'expense', 130_000, 'transport', 'gopay', 'Ojek online'],
  [24, 'expense', 260_000, 'food', 'gopay', 'Makan bersama teman'],
  [26, 'expense', 195_000, 'shopping', 'gopay', 'Kebutuhan rumah'],
  [28, 'expense', 72_000, 'food', 'cash', 'Sarapan'],
]

// Dibuat relatif terhadap hari ini supaya prototype selalu punya data bulan berjalan.
function generateTransactions(monthsBack: number) {
  const today = new Date()
  const result: Transaction[] = []
  for (let offset = monthsBack; offset >= 0; offset--) {
    // Variasi kecil agar tren antarbulan tidak datar.
    const scale = 1 + ((offset * 7) % 5) * 0.06
    monthlyRows.forEach(([day, type, amount, categoryId, accountId, note], index) => {
      const lastDay = new Date(today.getFullYear(), today.getMonth() - offset + 1, 0).getDate()
      const clampedDay = offset === 0 ? Math.min(day, today.getDate()) : Math.min(day, lastDay)
      const date = new Date(today.getFullYear(), today.getMonth() - offset, clampedDay)
      const isFixed = type === 'income' || categoryId === 'housing'
      result.push({
        id: `seed-${offset}-${String(index).padStart(2, '0')}`,
        type,
        amount: isFixed ? amount : Math.round((amount * scale) / 1000) * 1000,
        categoryId,
        accountId,
        date: toIsoDate(date),
        note,
      })
    })
  }
  return result
}

export const seedTransactions = generateTransactions(5)
