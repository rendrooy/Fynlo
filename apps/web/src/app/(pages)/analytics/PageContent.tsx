"use client";

import { Badge } from "@fynlo/ui/components/badge";

import { CardHeader } from "@/components/CardHeader";
import { CashflowChart } from "@/components/CashflowChart";
import { ExpenseBreakdown } from "@/components/ExpenseBreakdown";
import { useFinance } from "@/providers/finance-provider";
import {
  cashflowSeries,
  inMonth,
  lastMonths,
  previousMonth,
  topMerchants,
  totals,
  weekdayAverages,
} from "@/utils/finance";
import { formatMonth, formatMonthShort, formatRupiah } from "@/utils/format";

const savingsRate = ({ income, net }: { income: number; net: number }) =>
  income > 0 ? Math.round((net / income) * 100) : 0;

export default function PageContent() {
  const { transactions } = useFinance();
  const now = new Date();
  const months = lastMonths(6, now);
  const merchants = topMerchants(inMonth(transactions, now));
  const rate = savingsRate(totals(inMonth(transactions, now)));
  const lastRate = savingsRate(
    totals(inMonth(transactions, previousMonth(now))),
  );
  const rateChange = rate - lastRate;

  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <h1>Financial Analytics</h1>
          <p>Understand your financial patterns and habits in more depth.</p>
        </div>
        <span className="date-label">Last 6 months</span>
      </div>

      <div className="analytics-grid">
        <section className="card analytics-wide">
          <CardHeader
            subtitle="Cash flow trend over the last six months"
            title="Income vs Expenses"
          />
          <div className="chart-legend">
            <span>
              <i className="dot income" />
              Income
            </span>
            <span>
              <i className="dot expense" />
              Expenses
            </span>
          </div>
          <CashflowChart data={cashflowSeries(transactions, "monthly")} />
        </section>

        <section className="card">
          <CardHeader subtitle={formatMonth(now)} title="Expense Categories" />
          <ExpenseBreakdown />
        </section>

        <section className="card">
          <CardHeader
            subtitle="Net income per month"
            title="Monthly Cash Flow"
          />
          <div className="bar-chart">
            <Bars
              items={months.map((month) => {
                const { net } = totals(inMonth(transactions, month));
                return {
                  hint: formatRupiah(net),
                  label: formatMonthShort(month),
                  value: Math.max(net, 0),
                };
              })}
            />
          </div>
        </section>

        <section className="card">
          <CardHeader subtitle="By total spending" title="Top Merchants" />
          <div className="rank-list">
            {merchants.map((merchant, index) => (
              <div key={merchant.name}>
                <i>{index + 1}</i>
                <b>{merchant.name}</b>
                <span>{formatRupiah(merchant.amount)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <CardHeader
            subtitle="Average spending per day"
            title="Weekly Habits"
          />
          <div className="weekday-chart">
            <Bars
              items={weekdayAverages(transactions).map((day) => ({
                hint: formatRupiah(Math.round(day.value)),
                label: day.label,
                value: day.value,
              }))}
            />
          </div>
        </section>

        <section className="card analytics-wide savings">
          <CardHeader
            subtitle="Share of income you managed to keep"
            title="Net Savings Rate"
          />
          <div className="savings-number">
            <strong>{rate}%</strong>
            <Badge tone={rateChange >= 0 ? "success" : "danger"}>
              {rateChange >= 0 ? "+" : ""}
              {rateChange}% vs last month
            </Badge>
          </div>
          <div className="bar-chart savings-bars">
            <Bars
              items={months.map((month) => {
                const value = savingsRate(totals(inMonth(transactions, month)));
                return {
                  hint: `${value}%`,
                  label: formatMonthShort(month),
                  value: Math.max(value, 0),
                };
              })}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function Bars({
  items,
}: {
  items: { hint: string; label: string; value: number }[];
}) {
  const peak = Math.max(...items.map((item) => item.value), 1);
  return (
    <>
      {items.map((item) => (
        <div key={item.label} title={`${item.label}: ${item.hint}`}>
          <i style={{ height: `${Math.max((item.value / peak) * 80, 4)}%` }} />
          <span>{item.label}</span>
        </div>
      ))}
    </>
  );
}
