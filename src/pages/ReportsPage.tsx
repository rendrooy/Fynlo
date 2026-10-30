import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { CashflowChart } from '../components/CashflowChart'
import { CategoryIcon } from '../components/CategoryIcon'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/ui/Card'
import { inMonth, lastMonths, spentByCategory, totals } from '../lib/finance'
import { formatMonth, formatRupiah } from '../lib/format'
import { useFinance } from '../store/finance'

const MONTHS = lastMonths(6)

export function ReportsPage() {
  const { categories, transactions } = useFinance()
  const [index, setIndex] = useState(MONTHS.length - 1)
  const month = MONTHS[index]
  const monthTransactions = inMonth(transactions, month)
  const { income, expense } = totals(monthTransactions)
  const net = income - expense

  const breakdown = [...spentByCategory(monthTransactions).entries()]
    .map(([categoryId, amount]) => ({ category: categories.find((c) => c.id === categoryId), amount }))
    .sort((a, b) => b.amount - a.amount)
  const largest = breakdown[0]?.amount ?? 0

  return (
    <>
      <PageHeader title="Laporan" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Tren 6 bulan</h2>
          <CashflowChart height={240} showTable />
        </Card>

        <div className="flex items-center justify-between lg:col-span-2">
          <button
            type="button"
            aria-label="Bulan sebelumnya"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
            className="flex size-11 items-center justify-center rounded-full hover:bg-surface-muted disabled:opacity-30"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
          <p aria-live="polite" className="text-sm font-semibold">
            {formatMonth(month)}
          </p>
          <button
            type="button"
            aria-label="Bulan berikutnya"
            disabled={index === MONTHS.length - 1}
            onClick={() => setIndex(index + 1)}
            className="flex size-11 items-center justify-center rounded-full hover:bg-surface-muted disabled:opacity-30"
          >
            <ChevronRight aria-hidden="true" className="size-5" />
          </button>
        </div>

        <Card>
          <h2 className="mb-2 text-sm font-semibold">Ringkasan</h2>
          <dl className="divide-y divide-line text-sm">
            <div className="flex justify-between py-2.5">
              <dt className="text-muted">Pemasukan</dt>
              <dd className="font-medium tabular-nums">{formatRupiah(income)}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-muted">Pengeluaran</dt>
              <dd className="font-medium tabular-nums">{formatRupiah(expense)}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-muted">Selisih</dt>
              <dd className={`font-semibold tabular-nums ${net >= 0 ? 'text-income' : 'text-expense'}`}>
                {net >= 0 ? '+' : '−'}
                {formatRupiah(Math.abs(net))}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold">Pengeluaran per kategori</h2>
          {breakdown.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Belum ada pengeluaran di bulan ini.</p>
          ) : (
            <ul className="space-y-3">
              {breakdown.map(({ category, amount }) => (
                <li key={category?.id}>
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <CategoryIcon icon={category?.icon ?? ''} className="size-4 text-muted" />
                    <span className="min-w-0 flex-1 truncate">{category?.name}</span>
                    <span className="font-medium tabular-nums">{formatRupiah(amount)}</span>
                  </div>
                  <div className="h-2 rounded-r bg-transparent">
                    <div className="h-full rounded-r bg-accent" style={{ width: `${(amount / largest) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
