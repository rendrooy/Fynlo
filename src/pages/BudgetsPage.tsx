import { CircleAlert, TriangleAlert } from 'lucide-react'
import { CategoryIcon } from '../components/CategoryIcon'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/ui/Card'
import { ProgressBar, type ProgressTone } from '../components/ui/ProgressBar'
import { inMonth, spentByCategory } from '../lib/finance'
import { formatMonth, formatRupiah } from '../lib/format'
import { useFinance } from '../store/finance'

const WARNING_AT = 0.8

function toneFor(ratio: number): ProgressTone {
  if (ratio > 1) return 'over'
  return ratio >= WARNING_AT ? 'warning' : 'normal'
}

export function BudgetsPage() {
  const { budgets, categories, transactions } = useFinance()
  const now = new Date()
  const spent = spentByCategory(inMonth(transactions, now))
  const totalLimit = budgets.reduce((sum, budget) => sum + budget.limit, 0)
  const totalSpent = budgets.reduce((sum, budget) => sum + (spent.get(budget.categoryId) ?? 0), 0)
  const totalRatio = totalSpent / totalLimit
  const remaining = totalLimit - totalSpent

  return (
    <>
      <PageHeader title="Anggaran" subtitle={formatMonth(now)} />

      <Card className="mb-4">
        <p className="text-sm text-muted">{remaining >= 0 ? 'Sisa anggaran' : 'Melebihi anggaran'}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{formatRupiah(Math.abs(remaining))}</p>
        <div className="mt-3">
          <ProgressBar value={totalRatio} tone={toneFor(totalRatio)} label="Total anggaran terpakai" />
        </div>
        <p className="mt-2 text-xs text-muted tabular-nums">
          {formatRupiah(totalSpent)} dari {formatRupiah(totalLimit)}
        </p>
      </Card>

      <ul className="grid gap-3 lg:grid-cols-2">
        {budgets.map((budget) => {
          const category = categories.find((c) => c.id === budget.categoryId)
          const used = spent.get(budget.categoryId) ?? 0
          const ratio = used / budget.limit
          const tone = toneFor(ratio)
          const left = budget.limit - used
          return (
            <li key={budget.categoryId}>
              <Card>
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-muted">
                    <CategoryIcon icon={category?.icon ?? ''} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{category?.name}</p>
                    <p className="text-xs text-muted tabular-nums">
                      {formatRupiah(used)} dari {formatRupiah(budget.limit)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{Math.round(ratio * 100)}%</p>
                </div>
                <ProgressBar value={ratio} tone={tone} label={`Anggaran ${category?.name} terpakai`} />
                {tone === 'normal' && (
                  <p className="mt-2 text-xs text-muted tabular-nums">Sisa {formatRupiah(left)}</p>
                )}
                {tone === 'warning' && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-warning tabular-nums">
                    <TriangleAlert aria-hidden="true" className="size-3.5" />
                    Hampir habis, sisa {formatRupiah(left)}
                  </p>
                )}
                {tone === 'over' && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-expense tabular-nums">
                    <CircleAlert aria-hidden="true" className="size-3.5" />
                    Lebih {formatRupiah(-left)}
                  </p>
                )}
              </Card>
            </li>
          )
        })}
      </ul>
    </>
  )
}
