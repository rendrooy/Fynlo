"use client";

import { Badge } from "@fynlo/ui/components/badge";
import { Segmented } from "@fynlo/ui/components/segmented";
import { Select } from "@fynlo/ui/components/select";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ChartColumn,
  Info,
  type LucideIcon,
  Settings,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CardHeader } from "@/components/CardHeader";
import { CashflowChart } from "@/components/CashflowChart";
import {
  currentMonthToDate,
  DATE_RANGE_PRESETS,
  DateRangeFilter,
} from "@/components/DateRangeFilter";
import { EmptyState } from "@/components/EmptyState";
import { ExpenseBreakdown } from "@/components/ExpenseBreakdown";
import { TransactionList } from "@/components/TransactionList";
import { sourceLabels } from "@/constants";
import { useFinance } from "@/providers/finance-provider";
import {
  accountBalance,
  accountLabel,
  biggestIncrease,
  cashflowInRange,
  type CashflowPeriod,
  type DateRangePreset,
  resolveDateRange,
  signedAmount,
  sortNewestFirst,
  totalBalance,
  totals,
  touchesAccount,
  transactionsInRange,
} from "@/utils/finance";
import {
  formatCompact,
  formatRupiah,
  parseIsoDate,
  toIsoDate,
} from "@/utils/format";

export default function PageContent() {
  const { accounts, accountsStatus, categories, transactions } = useFinance();
  const [period, setPeriod] = useState<CashflowPeriod>("daily");
  const [preset, setPreset] = useState<DateRangePreset>("this-month");
  const [custom, setCustom] = useState(currentMonthToDate);
  const [chosenAccountId, setAccountId] = useState("all");
  // The chosen account may have been deleted.
  const account = accounts.find((a) => a.id === chosenAccountId);
  const scoped = account
    ? transactions.filter((t) => touchesAccount(t, account.id))
    : transactions;

  const { previous, range } = resolveDateRange(preset, custom, scoped);
  const today = toIsoDate(new Date());
  const inPeriod = transactionsInRange(scoped, range);
  const month = totals(inPeriod);
  const last = previous ? totals(transactionsInRange(scoped, previous)) : null;
  // A period that has ended shows the balance it ended with, as its statement does.
  const asOf = preset !== "all" && range.to < today ? range.to : undefined;
  const asOfLabel = asOf && formatFullDate(asOf);
  const balance = account
    ? accountBalance(account, transactions, asOf)
    : totalBalance(accounts, transactions, asOf);
  // Transfers don't count as income or expenses, but they do move one account's balance.
  const balanceChange = account
    ? inPeriod.reduce((sum, t) => sum + signedAmount(t, account.id), 0)
    : month.net;
  const series = cashflowInRange(scoped, range, period);
  const recent = sortNewestFirst(inPeriod).slice(0, 6);
  const periodLabel =
    DATE_RANGE_PRESETS.find((p) => p.value === preset)?.label ?? "";
  const compare = preset === "all" ? "" : compareLabel(preset);
  const insight = biggestIncrease(categories, scoped);
  const peak = Math.max(...(insight?.history ?? [1]), 1);

  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <h1>{greeting()}</h1>
          <p>Keep an eye on your finances in one place.</p>
        </div>
      </div>

      <div className="dashboard-filters">
        <DateRangeFilter
          custom={custom}
          onCustomChange={setCustom}
          onPresetChange={setPreset}
          preset={preset}
          range={range}
        />
        <Select
          aria-label="Filter by account"
          className="select-filter"
          onChange={setAccountId}
          options={[
            { label: "All accounts", value: "all" },
            ...accounts.map((a) => ({ label: accountLabel(a), value: a.id })),
          ]}
          value={account?.id ?? "all"}
        />
      </div>

      <div className="metric-grid">
        <MetricCard
          change={
            preset !== "all"
              ? percentChange(balance, balance - balanceChange)
              : null
          }
          helper={
            preset === "all"
              ? "balance today"
              : asOfLabel
                ? `on ${asOfLabel}, vs start of period`
                : "vs start of period"
          }
          icon={Wallet}
          title={account ? "Account Balance" : "Total Balance"}
          tone="emerald"
          value={formatRupiah(balance)}
        />
        <MetricCard
          change={last && percentChange(month.income, last.income)}
          helper={compare}
          icon={ArrowUp}
          title="Total Income"
          tone="blue"
          value={formatRupiah(month.income)}
        />
        <MetricCard
          change={last && percentChange(month.expense, last.expense)}
          goodWhenUp={false}
          helper={compare}
          icon={ArrowDown}
          title="Total Expenses"
          tone="rose"
          value={formatRupiah(month.expense)}
        />
        <MetricCard
          change={last && percentChange(month.net, last.net)}
          helper={compare}
          icon={ChartColumn}
          title="Net Cash Flow"
          tone="violet"
          value={formatRupiah(month.net)}
        />
      </div>

      <div className="dashboard-grid">
        <section className="card cashflow-card">
          <CardHeader
            action={
              <Segmented
                label="Cash flow period"
                onChange={setPeriod}
                options={[
                  { label: "Daily", value: "daily" },
                  { label: "Weekly", value: "weekly" },
                  { label: "Monthly", value: "monthly" },
                ]}
                value={period}
              />
            }
            subtitle="Income and expenses over time"
            title="Cash Flow"
          />
          <div className="chart-legend">
            <span>
              <i className="dot income" />
              Income <b>Rp{formatCompact(month.income)}</b>
            </span>
            <span>
              <i className="dot expense" />
              Expenses <b>Rp{formatCompact(month.expense)}</b>
            </span>
          </div>
          <CashflowChart data={series} />
        </section>
        <section className="card expense-card">
          <CardHeader
            action={
              <Link className="btn ghost" href="/analytics">
                Details <ArrowRight aria-hidden="true" size={15} />
              </Link>
            }
            subtitle="By category"
            title="Expenses"
          />
          <ExpenseBreakdown
            periodLabel={periodLabel.toLowerCase()}
            range={range}
            transactions={scoped}
          />
        </section>
      </div>

      <div className="section-heading">
        <div>
          <h2>Connected Accounts</h2>
          <p>
            {asOfLabel
              ? `Balances on ${asOfLabel}, based on recorded transactions.`
              : "Balances based on recorded transactions."}
          </p>
        </div>
        <Link className="btn secondary" href="/settings/accounts">
          <Settings aria-hidden="true" size={17} />
          Manage Accounts
        </Link>
      </div>
      {accountsStatus === "ready" && accounts.length === 0 && (
        <div className="card">
          <EmptyState
            description="Your accounts and balances will appear here."
            icon={Wallet}
            title="No accounts yet"
          />
        </div>
      )}
      <div className="accounts-grid">
        {(account ? [account] : accounts).map((item) => {
          const latest = sortNewestFirst(
            transactions.filter(
              (t) => touchesAccount(t, item.id) && (!asOf || t.date <= asOf),
            ),
          )[0];
          const estimated = latest?.source === "email";
          return (
            <div className="account-card" key={item.id}>
              <div className="account-head">
                <div className="bank-logo" style={{ background: item.color }}>
                  {item.name[0]}
                </div>
                <div>
                  <b>{item.name}</b>
                  {item.mask && <span>•• {item.mask}</span>}
                </div>
              </div>
              <div className="account-label">
                {estimated ? "ESTIMATED" : "RECORDED"} BALANCE
                {asOfLabel && ` ON ${asOfLabel.toUpperCase()}`}
              </div>
              <div className="account-balance">
                {formatRupiah(accountBalance(item, transactions, asOf))}
              </div>
              <div className="account-foot">
                <div>
                  <span>Latest from</span>
                  <b>{latest ? sourceLabels[latest.source] : "-"}</b>
                </div>
                <div>
                  <span>Last activity</span>
                  <b>{latest ? formatFullDate(latest.date) : "-"}</b>
                </div>
              </div>
              <Badge
                tone={
                  estimated
                    ? "warning"
                    : latest?.source === "import"
                      ? "success"
                      : undefined
                }
              >
                <span className="status-dot" />
                {estimated
                  ? "Not checked against a statement"
                  : latest?.source === "import"
                    ? "Imported from a statement"
                    : latest
                      ? "Entered by you"
                      : "No activity yet"}
              </Badge>
            </div>
          );
        })}
      </div>

      <div className="content-split">
        <section className="card recent-card">
          <CardHeader
            action={
              <Link
                className="btn ghost"
                href={
                  account
                    ? `/transactions?accountId=${account.id}`
                    : "/transactions"
                }
              >
                See All <ArrowRight aria-hidden="true" size={15} />
              </Link>
            }
            subtitle="Latest activity in this period"
            title="Recent Transactions"
          />
          {recent.length > 0 ? (
            <TransactionList items={recent} />
          ) : (
            <EmptyState
              description={
                scoped.length === 0
                  ? "Your latest activity will appear here."
                  : "Try a different date range."
              }
              icon={ArrowLeftRight}
              title={
                scoped.length === 0
                  ? "No transactions yet"
                  : "No transactions in this period"
              }
            />
          )}
        </section>
        <aside className="insight-card">
          <div className="insight-top">
            <div className="spark">
              <ChartColumn aria-hidden="true" size={20} />
            </div>
            <Badge tone="success">THIS MONTH&apos;S INSIGHT</Badge>
          </div>
          {insight ? (
            <>
              <h3>
                {insight.name} spending is up
                {insight.percent !== null && ` ${insight.percent}%`}
              </h3>
              <p>
                You spent <b>{formatRupiah(insight.difference)}</b> more on{" "}
                {insight.name.toLowerCase()} than last month.
              </p>
              <div aria-hidden="true" className="mini-bars">
                {insight.history.map((value, index) => (
                  <i
                    key={index}
                    style={{
                      height: `${Math.max((value / peak) * 100, 6)}%`,
                      opacity: index === insight.history.length - 1 ? 1 : 0.55,
                    }}
                  />
                ))}
              </div>
            </>
          ) : scoped.length === 0 ? (
            <>
              <h3>No insights yet</h3>
              <p>Insights appear once you have recorded some transactions.</p>
            </>
          ) : (
            <>
              <h3>No category grew this month</h3>
              <p>Every category is at or below last month&apos;s spending.</p>
            </>
          )}
          <Link className="btn secondary" href="/analytics">
            See details <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </aside>
      </div>
    </div>
  );
}

function compareLabel(preset: DateRangePreset) {
  if (preset === "this-month" || preset === "last-month") {
    return "vs previous month";
  }
  return preset === "this-year" ? "vs last year" : "vs previous period";
}

function formatFullDate(iso: string) {
  return parseIsoDate(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  return hour < 18 ? "Good afternoon" : "Good evening";
}

function MetricCard({
  change,
  goodWhenUp = true,
  helper,
  icon: Icon,
  title,
  tone,
  value,
}: {
  /** Null when there's nothing to compare against. */
  change: null | number;
  goodWhenUp?: boolean;
  helper: string;
  icon: LucideIcon;
  title: string;
  tone: string;
  value: string;
}) {
  const up = (change ?? 0) >= 0;
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <div className="card metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon aria-hidden="true" size={20} />
      </div>
      <div className="metric-title">
        {title}
        <Info aria-hidden="true" size={14} />
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">
        {change === null ? null : change === 0 ? (
          <Badge>0%</Badge>
        ) : (
          <Badge tone={up === goodWhenUp ? "success" : "danger"}>
            <Arrow aria-hidden="true" size={12} />
            {up ? "+" : ""}
            {change}%
          </Badge>
        )}
        <span>{helper}</span>
      </div>
    </div>
  );
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}
