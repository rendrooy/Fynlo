"use client";

import { Button } from "@fynlo/ui/components/button";
import { Select } from "@fynlo/ui/components/select";
import { ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { TransactionList } from "@/components/TransactionList";
import { useFinance } from "@/providers/finance-provider";
import {
  accountLabel,
  calendarDays,
  sortNewestFirst,
  totals,
  touchesAccount,
} from "@/utils/finance";
import {
  formatMonth,
  formatRupiah,
  monthKey,
  parseIsoDate,
  toIsoDate,
} from "@/utils/format";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHORT = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 1,
  notation: "compact",
});
const FULL = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** Phones have room for the short form only; CSS shows the one that fits. */
function CellAmount({
  className,
  value,
}: {
  className: string;
  value: number;
}) {
  return (
    <span className={className}>
      <span className="calendar-full">{FULL.format(value)}</span>
      <span className="calendar-short">
        {SHORT.format(value).replace(/\s/g, "")}
      </span>
    </span>
  );
}

const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

export default function PageContent() {
  const { accounts, transactions } = useFinance();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<null | string>(null);
  const [chosenAccountId, setAccountId] = useState("all");
  // The chosen account may have been deleted.
  const account = accounts.find((a) => a.id === chosenAccountId);
  const scoped = account
    ? transactions.filter((t) => touchesAccount(t, account.id))
    : transactions;

  const today = toIsoDate(new Date());
  const days = calendarDays(scoped, month);
  const key = monthKey(month);
  const summary = totals(scoped.filter((t) => t.date.startsWith(key)));
  const dayItems = selected
    ? sortNewestFirst(scoped.filter((t) => t.date === selected))
    : [];
  const months = [
    ...new Set([...scoped.map((t) => t.date.slice(0, 7)), key]),
  ].sort((a, b) => b.localeCompare(a));
  const latest = months.find((m) => scoped.some((t) => t.date.startsWith(m)));

  function goTo(next: Date) {
    setMonth(startOfMonth(next));
    setSelected(null);
  }

  return (
    <div className="page">
      <div className="page-intro">
        <div>
          <h1>Calendar</h1>
          <p>See your income and spending day by day.</p>
        </div>
      </div>

      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button
            aria-label="Previous month"
            className="icon-btn"
            onClick={() =>
              goTo(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <div className="calendar-month">
            <Select
              aria-label="Go to month"
              onChange={(value) => goTo(parseIsoDate(`${value}-01`))}
              options={months.map((value) => ({
                label: formatMonth(parseIsoDate(`${value}-01`)),
                value,
              }))}
              value={key}
            />
          </div>
          <button
            aria-label="Next month"
            className="icon-btn"
            onClick={() =>
              goTo(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
            type="button"
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
          <Button kind="secondary" onClick={() => goTo(new Date())}>
            Today
          </Button>
        </div>
        <div className="calendar-account">
          <Select
            aria-label="Filter by account"
            onChange={(value) => {
              setAccountId(value);
              setSelected(null);
            }}
            options={[
              { label: "All accounts", value: "all" },
              ...accounts.map((a) => ({ label: accountLabel(a), value: a.id })),
            ]}
            value={account?.id ?? "all"}
          />
        </div>
      </div>

      <div className="card calendar-summary">
        <div>
          <span>Income</span>
          <b className="positive">{formatRupiah(summary.income)}</b>
        </div>
        <div>
          <span>Expenses</span>
          <b className="negative">{formatRupiah(summary.expense)}</b>
        </div>
        <div>
          <span>Net</span>
          <b>{formatRupiah(summary.net)}</b>
        </div>
      </div>

      <div className="card calendar">
        <div aria-hidden="true" className="calendar-head">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {days.map((day) =>
            day.inMonth ? (
              <button
                aria-label={`${day.date}, income ${formatRupiah(day.income)}, expenses ${formatRupiah(day.expense)}, ${day.count} transactions`}
                aria-pressed={selected === day.date}
                className={`calendar-day ${day.date === today ? "today" : ""}`}
                key={day.date}
                onClick={() =>
                  setSelected(selected === day.date ? null : day.date)
                }
                type="button"
              >
                <i>{parseIsoDate(day.date).getDate()}</i>
                {day.income > 0 && (
                  <CellAmount className="positive" value={day.income} />
                )}
                {day.expense > 0 && (
                  <CellAmount className="negative" value={day.expense} />
                )}
                {day.income > 0 && day.expense > 0 && (
                  <CellAmount
                    className="calendar-net"
                    value={day.income - day.expense}
                  />
                )}
                {day.transfers > 0 && (
                  <small aria-hidden="true">
                    <ArrowLeftRight size={10} />
                    {day.transfers}
                  </small>
                )}
              </button>
            ) : (
              <div className="calendar-day outside" key={day.date}>
                <i>{parseIsoDate(day.date).getDate()}</i>
              </div>
            ),
          )}
        </div>
      </div>

      {selected ? (
        <section className="card recent-card calendar-list">
          <div className="card-header">
            <div>
              <h2>
                {parseIsoDate(selected).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  weekday: "long",
                  year: "numeric",
                })}
              </h2>
            </div>
          </div>
          {dayItems.length > 0 ? (
            <TransactionList items={dayItems} />
          ) : (
            <EmptyState
              description="Nothing was recorded on this day."
              icon={ArrowLeftRight}
              title="No transactions"
            />
          )}
        </section>
      ) : (
        latest &&
        latest !== key &&
        summary.income + summary.expense === 0 &&
        !scoped.some((t) => t.date.startsWith(key)) && (
          <div className="calendar-hint">
            <span>No transactions this month.</span>
            <button
              className="text-link"
              onClick={() => goTo(parseIsoDate(`${latest}-01`))}
              type="button"
            >
              Go to {formatMonth(parseIsoDate(`${latest}-01`))}
            </button>
          </div>
        )
      )}
    </div>
  );
}
