import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CashflowChart } from '../components/CashflowChart'
import { TransactionRow } from '../components/TransactionRow'
import { Card } from '../components/ui/Card'
import { inMonth, sortNewestFirst, totalBalance, totals } from '../lib/finance'
import { formatMonth, formatRupiah } from '../lib/format'
import { useFinance } from '../store/finance'

export function HomePage() {
  const { accounts, transactions } = useFinance()
  const now = new Date()
  const month = totals(inMonth(transactions, now))
  const recent = sortNewestFirst(transactions).slice(0, 5)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <section className="lg:col-span-5">
        <h1 className="sr-only">Beranda</h1>
        <p className="text-sm text-muted">Total saldo</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums lg:text-5xl">
          {formatRupiah(totalBalance(accounts, transactions))}
        </p>
        <p className="mt-1 text-sm text-muted">dari {accounts.length} akun</p>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:col-span-5">
        <Card>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <ArrowDownLeft aria-hidden="true" className="size-4 text-income" />
            Pemasukan
          </p>
          <p className="mt-1 text-base font-semibold tabular-nums lg:text-xl">{formatRupiah(month.income)}</p>
        </Card>
        <Card>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <ArrowUpRight aria-hidden="true" className="size-4 text-expense" />
            Pengeluaran
          </p>
          <p className="mt-1 text-base font-semibold tabular-nums lg:text-xl">{formatRupiah(month.expense)}</p>
        </Card>
        <p className="col-span-2 -mt-1 text-xs text-muted">Ringkasan {formatMonth(now)}</p>
      </div>

      <Card className="lg:col-span-3">
        <h2 className="mb-3 text-sm font-semibold">Arus kas 6 bulan</h2>
        <CashflowChart />
      </Card>

      <Card className="lg:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Transaksi terbaru</h2>
          <Link to="/transaksi" className="py-1 text-sm font-medium text-accent">
            Lihat semua
          </Link>
        </div>
        <ul className="divide-y divide-line">
          {recent.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
        </ul>
      </Card>
    </div>
  )
}
