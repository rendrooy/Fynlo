import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { TransactionRow } from '../components/TransactionRow'
import { Card } from '../components/ui/Card'
import { fieldClass } from '../components/ui/Input'
import { Segmented } from '../components/ui/Segmented'
import { groupByDate } from '../lib/finance'
import { formatDayHeading } from '../lib/format'
import { useFinance } from '../store/finance'
import type { TransactionType } from '../types'

type TypeFilter = 'all' | TransactionType

export function TransactionsPage() {
  const { categories, transactions } = useFinance()
  const [query, setQuery] = useState('')
  const [type, setType] = useState<TypeFilter>('all')
  const [categoryId, setCategoryId] = useState('all')

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return groupByDate(
      transactions.filter((t) => {
        const categoryName = categories.find((c) => c.id === t.categoryId)?.name ?? ''
        return (
          (type === 'all' || t.type === type) &&
          (categoryId === 'all' || t.categoryId === categoryId) &&
          (!needle || `${t.note} ${categoryName}`.toLowerCase().includes(needle))
        )
      }),
    )
  }, [transactions, categories, query, type, categoryId])

  function changeType(next: TypeFilter) {
    setType(next)
    const selected = categories.find((c) => c.id === categoryId)
    if (next !== 'all' && selected && selected.type !== next) setCategoryId('all')
  }

  return (
    <>
      <PageHeader title="Transaksi" />

      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <label className="relative block">
          <span className="sr-only">Cari transaksi</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Cari catatan atau kategori"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`${fieldClass} pl-9`}
          />
        </label>
        <Segmented
          label="Filter jenis"
          value={type}
          onChange={changeType}
          options={[
            { value: 'all', label: 'Semua' },
            { value: 'expense', label: 'Keluar' },
            { value: 'income', label: 'Masuk' },
          ]}
        />
        <label>
          <span className="sr-only">Filter kategori</span>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={fieldClass}>
            <option value="all">Semua kategori</option>
            {categories
              .filter((c) => type === 'all' || c.type === type)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        </label>
      </div>

      {groups.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="font-medium">Tidak ada transaksi yang cocok</p>
          <p className="mt-1 text-sm text-muted">Coba ubah kata kunci atau filter.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-1.5 text-xs font-semibold text-muted">{formatDayHeading(date)}</h2>
              <Card className="py-0">
                <ul className="divide-y divide-line">
                  {items.map((transaction) => (
                    <TransactionRow key={transaction.id} transaction={transaction} />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
