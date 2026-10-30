"use client";

import { useFinance } from "@/providers/finance-provider";
import { expenseBreakdown } from "@/utils/finance";
import { formatCompact, formatRupiah } from "@/utils/format";

export function ExpenseBreakdown() {
  const { categories, transactions } = useFinance();
  const { rows, total } = expenseBreakdown(categories, transactions);

  let start = 0;
  const stops = rows.map((row) => {
    const end = total > 0 ? start + (row.amount / total) * 100 : start;
    const stop = `${row.color} ${start}% ${end}%`;
    start = end;
    return stop;
  });

  return (
    <div className="expense-content">
      <div
        aria-label={`Spending by category, total ${formatRupiah(total)}`}
        className="donut"
        role="img"
        style={{
          background: stops.length
            ? `conic-gradient(${stops.join(",")})`
            : "var(--surface-2)",
        }}
      >
        <div>
          <span>Total</span>
          <strong>Rp{formatCompact(total)}</strong>
          <small>this month</small>
        </div>
      </div>
      <div className="category-list">
        {rows.map((row) => (
          <div className="category-row" key={row.id}>
            <span className="cat-dot" style={{ background: row.color }} />
            <div>
              <b>{row.name}</b>
              <span>{formatRupiah(row.amount)}</span>
            </div>
            <strong>{row.percent}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
