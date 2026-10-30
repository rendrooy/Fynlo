import { formatRupiah } from '../lib/format'
import { useFinance } from '../store/finance'
import type { Transaction } from '../types'
import { CategoryIcon } from './CategoryIcon'

export function TransactionRow({ transaction }: { transaction: Transaction }) {
  const { categories, accounts } = useFinance()
  const category = categories.find((c) => c.id === transaction.categoryId)
  const account = accounts.find((a) => a.id === transaction.accountId)
  const isIncome = transaction.type === 'income'

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-muted">
        <CategoryIcon icon={category?.icon ?? ''} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{transaction.note || category?.name}</p>
        <p className="truncate text-xs text-muted">
          {category?.name} · {account?.name}
        </p>
      </div>
      <p className={`shrink-0 text-sm font-semibold tabular-nums ${isIncome ? 'text-income' : 'text-ink'}`}>
        {isIncome ? '+' : '−'}
        {formatRupiah(transaction.amount)}
      </p>
    </li>
  )
}
