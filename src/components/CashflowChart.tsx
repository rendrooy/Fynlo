import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { inMonth, lastMonths, totals } from '../lib/finance'
import { formatCompact, formatMonthShort, formatRupiah } from '../lib/format'
import { useFinance } from '../store/finance'

const INCOME = 'var(--chart-income)'
const EXPENSE = 'var(--chart-expense)'

function Key({ color, label, value }: { color: string; label: string; value?: number }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
      {value !== undefined && <span className="ml-auto pl-3 font-medium text-ink tabular-nums">{formatRupiah(value)}</span>}
    </span>
  )
}

interface CashflowChartProps {
  months?: number
  height?: number
  showTable?: boolean
}

/** Pemasukan dan pengeluaran per bulan dalam satu sumbu. */
export function CashflowChart({ months = 6, height = 200, showTable = false }: CashflowChartProps) {
  const { transactions } = useFinance()
  const rows = lastMonths(months).map((month) => ({
    label: formatMonthShort(month),
    ...totals(inMonth(transactions, month)),
  }))

  return (
    <div>
      <div className="mb-3 flex gap-4">
        <Key color={INCOME} label="Pemasukan" />
        <Key color={EXPENSE} label="Pengeluaran" />
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 320, height }}>
          <BarChart data={rows} barGap={2} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
            />
            <YAxis
              width={36}
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              tickFormatter={(value: number) => formatCompact(value)}
            />
            <Tooltip
              isAnimationActive={false}
              cursor={{ fill: 'var(--surface-muted)' }}
              content={({ active, label }) => {
                const row = rows.find((r) => r.label === label)
                if (!active || !row) return null
                return (
                  <div className="min-w-44 space-y-1 rounded-xl border border-line bg-surface p-3 shadow-lg">
                    <p className="text-xs font-semibold text-ink">{row.label}</p>
                    <Key color={INCOME} label="Pemasukan" value={row.income} />
                    <Key color={EXPENSE} label="Pengeluaran" value={row.expense} />
                  </div>
                )
              }}
            />
            <Bar dataKey="income" name="Pemasukan" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={16} isAnimationActive={false} />
            <Bar dataKey="expense" name="Pengeluaran" fill={EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={16} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {showTable && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer py-1 text-muted">Lihat sebagai tabel</summary>
          <table className="mt-2 w-full text-left text-xs tabular-nums">
            <thead className="text-muted">
              <tr>
                <th className="py-1 font-medium">Bulan</th>
                <th className="py-1 text-right font-medium">Pemasukan</th>
                <th className="py-1 text-right font-medium">Pengeluaran</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-line">
                  <td className="py-1.5">{row.label}</td>
                  <td className="py-1.5 text-right">{formatRupiah(row.income)}</td>
                  <td className="py-1.5 text-right">{formatRupiah(row.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  )
}
