"use client";

import { Badge } from "@fynlo/ui/components/badge";
import { Button } from "@fynlo/ui/components/button";
import {
  ArrowLeftRight,
  Check,
  Eye,
  Link2,
  ListFilter,
  Plus,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { TransactionIcon } from "@/components/CategoryIcon";
import { sourceLabels } from "@/constants";
import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";
import { ApiError } from "@/services/api";
import { accountLabel, sortNewestFirst } from "@/utils/finance";
import { formatDayShort, formatRupiah, toIsoDate } from "@/utils/format";

export default function PageContent() {
  const { accounts, categories, transactions, updateTransaction } =
    useFinance();
  const router = useRouter();
  const { openDetails, openSheet, toast } = useTransactionSheet();
  const [confirmed, setConfirmed] = useState<string[]>([]);

  const now = new Date();
  const weekStart = toIsoDate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6),
  );
  const pending = sortNewestFirst(transactions).filter(
    (t) => t.status === "review",
  );
  const shown = sortNewestFirst(transactions).filter(
    (t) => t.status === "review" || confirmed.includes(t.id),
  );
  const detected = transactions.filter(
    (t) => t.date >= weekStart && t.source !== "manual",
  ).length;
  const seen = new Set<string>();
  let duplicates = 0;
  for (const t of transactions) {
    const key = `${t.date}|${t.name}|${t.amount}`;
    if (seen.has(key)) duplicates += 1;
    seen.add(key);
  }

  return (
    <div className="page">
      <div className="review-hero">
        <div>
          <Badge tone="warning">
            REVIEW {formatDayShort(weekStart).toUpperCase()}–
            {formatDayShort(toIsoDate(now)).toUpperCase()}
          </Badge>
          <h1>Tidy up this week&apos;s finances</h1>
          <p>
            Confirm automatically detected transactions to keep your reports
            accurate.
          </p>
        </div>
        <div className="review-score">
          <strong>
            {confirmed.length}/{shown.length}
          </strong>
          <span>done</span>
        </div>
      </div>

      <div className="review-metrics">
        <div className="card">
          <ArrowLeftRight aria-hidden="true" size={20} />
          <span>Detected transactions</span>
          <b>{detected}</b>
        </div>
        <div className="card warning">
          <Eye aria-hidden="true" size={20} />
          <span>Needs review</span>
          <b>{pending.length}</b>
        </div>
        <div className="card">
          <Link2 aria-hidden="true" size={20} />
          <span>Possible duplicates</span>
          <b>{duplicates}</b>
        </div>
        <div className="card">
          <ListFilter aria-hidden="true" size={20} />
          <span>Uncategorized</span>
          <b>
            {
              transactions.filter((t) => !t.categoryId && t.type !== "transfer")
                .length
            }
          </b>
        </div>
      </div>

      <div className="review-layout">
        <section>
          <div className="section-heading">
            <div>
              <h2>Needs Review</h2>
              <p>Make sure the details below are correct.</p>
            </div>
          </div>
          {shown.length === 0 && (
            <div className="card empty">
              <div>
                <Check aria-hidden="true" size={20} />
              </div>
              <b>Nothing to review</b>
              <span>You are all caught up for this week.</span>
            </div>
          )}
          {shown.map((t) => {
            const category = categories.find((c) => c.id === t.categoryId);
            const account = accounts.find((a) => a.id === t.accountId);
            const done = t.status === "verified";
            return (
              <div
                className={`card review-card ${done ? "reviewed" : ""}`}
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
              ? `You still have ${pending.length} transactions to confirm.`
              : "Everything has been confirmed."}
          </span>
        </div>
        <Button
          onClick={() =>
            toast(
              pending.length === 0
                ? "Weekly review complete"
                : "Confirm every transaction first",
            )
          }
        >
          <Check aria-hidden="true" size={17} />
          Finish Weekly Review
        </Button>
      </div>
    </div>
  );
}
