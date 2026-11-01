"use client";

import { Badge } from "@fynlo/ui/components/badge";
import { Button } from "@fynlo/ui/components/button";
import {
  ArrowLeftRight,
  Check,
  Eye,
  Link2,
  ListFilter,
  type LucideIcon,
  Plus,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { TransactionIcon } from "@/components/CategoryIcon";
import {
  currentMonthToDate,
  DateRangeFilter,
} from "@/components/DateRangeFilter";
import { sourceLabels } from "@/constants";
import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";
import { ApiError } from "@/services/api";
import {
  accountLabel,
  type DateRangePreset,
  resolveDateRange,
  sortNewestFirst,
} from "@/utils/finance";
import { formatDayShort, formatRupiah } from "@/utils/format";

type ReviewFilter = "detected" | "duplicates" | "review" | "uncategorized";

const FILTER_TEXT: Record<
  ReviewFilter,
  { description: string; emptyText: string; emptyTitle: string; title: string }
> = {
  detected: {
    description: "Recorded automatically in this period.",
    emptyText: "Nothing was recorded automatically in this period.",
    emptyTitle: "No detected transactions",
    title: "Detected Transactions",
  },
  duplicates: {
    description:
      "These share the same date, name, and amount. Marking one clears its whole group.",
    emptyText: "No transactions in this period look the same.",
    emptyTitle: "No possible duplicates",
    title: "Possible Duplicates",
  },
  review: {
    description: "Make sure the details below are correct.",
    emptyText: "You are all caught up for this period.",
    emptyTitle: "Nothing to review",
    title: "Needs Review",
  },
  uncategorized: {
    description: "Open Details, then Edit, to choose a category.",
    emptyText: "Every transaction in this period has a category.",
    emptyTitle: "Nothing uncategorized",
    title: "Uncategorized",
  },
};

export default function PageContent() {
  const {
    accounts,
    categories,
    markNotDuplicate,
    transactions,
    updateTransaction,
  } = useFinance();
  const router = useRouter();
  const { openDetails, openSheet, toast } = useTransactionSheet();
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [filter, setFilter] = useState<ReviewFilter>("review");
  const [preset, setPreset] = useState<DateRangePreset>("month-to-date");
  const [custom, setCustom] = useState(currentMonthToDate);

  const { range } = resolveDateRange(preset, custom, transactions);
  const newest = sortNewestFirst(transactions);
  const duplicateKey = (t: (typeof transactions)[number]) =>
    `${t.date}|${t.name}|${t.amount}`;
  const keyCounts = new Map<string, number>();
  for (const t of transactions) {
    const key = duplicateKey(t);
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }
  // A new look-alike reopens a group the user already checked.
  const unsettledKeys = new Set(
    transactions
      .filter(
        (t) => !t.isNotDuplicate && (keyCounts.get(duplicateKey(t)) ?? 0) > 1,
      )
      .map(duplicateKey),
  );
  const everywhere: Record<ReviewFilter, typeof transactions> = {
    detected: newest.filter((t) => t.source !== "manual"),
    // Copies stay next to each other, so they're easy to compare.
    duplicates: newest
      .filter((t) => unsettledKeys.has(duplicateKey(t)))
      .sort((a, b) => duplicateKey(b).localeCompare(duplicateKey(a))),
    review: newest.filter(
      (t) => t.status === "review" || confirmed.includes(t.id),
    ),
    uncategorized: newest.filter((t) => !t.categoryId && t.type !== "transfer"),
  };
  const inPeriod = (list: typeof transactions) =>
    list.filter((t) => t.date >= range.from && t.date <= range.to);
  const lists: Record<ReviewFilter, typeof transactions> = {
    detected: inPeriod(everywhere.detected),
    duplicates: inPeriod(everywhere.duplicates),
    review: inPeriod(everywhere.review),
    uncategorized: inPeriod(everywhere.uncategorized),
  };
  const reviewList = lists.review;
  const pending = reviewList.filter((t) => t.status === "review");
  const doneCount = reviewList.length - pending.length;
  const shown = lists[filter];
  const outsideCount = everywhere[filter].length - shown.length;
  const text = FILTER_TEXT[filter];
  const metrics: {
    count: number;
    filter: ReviewFilter;
    icon: LucideIcon;
    label: string;
    warning?: boolean;
  }[] = [
    {
      count: lists.detected.length,
      filter: "detected",
      icon: ArrowLeftRight,
      label: "Detected transactions",
    },
    {
      count: pending.length,
      filter: "review",
      icon: Eye,
      label: "Needs review",
      warning: true,
    },
    {
      count: lists.duplicates.length,
      filter: "duplicates",
      icon: Link2,
      label: "Possible duplicates",
    },
    {
      count: lists.uncategorized.length,
      filter: "uncategorized",
      icon: ListFilter,
      label: "Uncategorized",
    },
  ];

  return (
    <div className="page">
      <DateRangeFilter
        custom={custom}
        onCustomChange={setCustom}
        onPresetChange={setPreset}
        preset={preset}
        range={range}
      />

      <div className="review-hero">
        <div>
          <Badge tone="warning">
            REVIEW {formatDayShort(range.from).toUpperCase()}–
            {formatDayShort(range.to).toUpperCase()}
          </Badge>
          <h1>Tidy up your finances</h1>
          <p>
            Confirm automatically detected transactions to keep your reports
            accurate.
          </p>
        </div>
        <div className="review-score">
          <strong>
            {doneCount}/{reviewList.length}
          </strong>
          <span>done</span>
        </div>
      </div>

      <div className="review-metrics">
        {metrics.map((metric) => (
          <button
            aria-pressed={filter === metric.filter}
            className={`card ${metric.warning ? "warning" : ""} ${filter === metric.filter ? "active" : ""}`}
            key={metric.filter}
            onClick={() => setFilter(metric.filter)}
            type="button"
          >
            <metric.icon aria-hidden="true" size={20} />
            <span>{metric.label}</span>
            <b>{metric.count}</b>
          </button>
        ))}
      </div>

      <div className="review-layout">
        <section>
          <div className="section-heading">
            <div>
              <h2>{text.title}</h2>
              <p>{text.description}</p>
            </div>
          </div>
          {outsideCount > 0 && (
            <p className="review-outside">
              {outsideCount} more outside this period.{" "}
              <button
                className="text-link"
                onClick={() => setPreset("all")}
                type="button"
              >
                Show all time
              </button>
            </p>
          )}
          {shown.length === 0 && (
            <div className="card empty">
              <div>
                <Check aria-hidden="true" size={20} />
              </div>
              <b>{text.emptyTitle}</b>
              <span>{text.emptyText}</span>
            </div>
          )}
          {shown.map((t) => {
            const category = categories.find((c) => c.id === t.categoryId);
            const account = accounts.find((a) => a.id === t.accountId);
            const done = t.status === "verified";
            return (
              <div
                className={`card review-card ${done && filter === "review" ? "reviewed" : ""}`}
                key={t.id}
              >
                <TransactionIcon
                  color={category?.color}
                  icon={t.type === "transfer" ? "transfer" : category?.icon}
                />
                <div className="review-main">
                  <b>{t.name}</b>
                  <span>
                    {formatDayShort(t.date)}, {t.time} · {accountLabel(account)}
                  </span>
                  <div>
                    <Badge>
                      {t.type === "transfer"
                        ? "Transfer"
                        : (category?.name ?? "Uncategorized")}
                    </Badge>
                    <Badge tone="warning">{sourceLabels[t.source]}</Badge>
                  </div>
                </div>
                <strong>
                  {formatRupiah(t.type === "expense" ? -t.amount : t.amount)}
                </strong>
                <div className="review-actions">
                  <Button kind="secondary" onClick={() => openDetails(t)}>
                    <Eye aria-hidden="true" size={17} />
                    Details
                  </Button>
                  {filter === "duplicates" && (
                    <Button
                      kind="secondary"
                      onClick={() => {
                        const group = transactions
                          .filter((x) => duplicateKey(x) === duplicateKey(t))
                          .map((x) => x.id);
                        markNotDuplicate(group)
                          .then(() =>
                            toast(
                              `${group.length} transactions marked as not duplicates`,
                            ),
                          )
                          .catch((error: unknown) =>
                            toast(
                              error instanceof ApiError
                                ? error.message
                                : "Please try again.",
                              true,
                            ),
                          );
                      }}
                    >
                      <X aria-hidden="true" size={17} />
                      Not a duplicate
                    </Button>
                  )}
                  <Button
                    disabled={done}
                    onClick={() => {
                      updateTransaction(t.id, { status: "verified" })
                        .then(() => {
                          setConfirmed((current) => [...current, t.id]);
                          toast("Transaction marked as reviewed");
                        })
                        .catch((error: unknown) =>
                          toast(
                            error instanceof ApiError
                              ? error.message
                              : "Please try again.",
                            true,
                          ),
                        );
                    }}
                  >
                    <Check aria-hidden="true" size={17} />
                    {done ? "Reviewed" : "Confirm"}
                  </Button>
                </div>
              </div>
            );
          })}
        </section>

        <aside className="card review-side">
          <div className="illustration">
            <Check aria-hidden="true" size={34} />
          </div>
          <h3>Missed a transaction?</h3>
          <p>
            Add it manually or import a bank statement to reconcile your
            records.
          </p>
          <Button kind="secondary" onClick={() => openSheet()}>
            <Plus aria-hidden="true" size={17} />
            Add Manually
          </Button>
          <Button kind="ghost" onClick={() => router.push("/settings/import")}>
            <Upload aria-hidden="true" size={17} />
            Import Bank Statement
          </Button>
          <div className="privacy-note">
            <ShieldCheck aria-hidden="true" size={17} />
            <span>
              Files are used only for reconciliation and never shared.
            </span>
          </div>
        </aside>
      </div>

      <div className="review-complete">
        <div>
          <b>Finished checking?</b>
          <span>
            {pending.length > 0
              ? `You still have ${pending.length} ${pending.length === 1 ? "transaction" : "transactions"} to confirm.`
              : "Everything has been confirmed."}
          </span>
        </div>
        <Button
          onClick={() =>
            toast(
              pending.length === 0
                ? "Review complete"
                : "Confirm every transaction first",
            )
          }
        >
          <Check aria-hidden="true" size={17} />
          Finish Review
        </Button>
      </div>
    </div>
  );
}
