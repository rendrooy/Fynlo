"use client";

import type { TransactionInterface } from "@fynlo/types";

import { Badge } from "@fynlo/ui/components/badge";
import { ChevronRight } from "lucide-react";

import { statusLabels } from "@/constants";
import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";
import { accountLabel } from "@/utils/finance";
import { formatDayShort, formatRupiah } from "@/utils/format";

import { TransactionIcon } from "./CategoryIcon";

export function TransactionList({ items }: { items: TransactionInterface[] }) {
  const { accounts, categories } = useFinance();
  const { openDetails } = useTransactionSheet();

  return (
    <div className="transaction-list">
      {items.map((t) => {
        const category = categories.find((c) => c.id === t.categoryId);
        const account = accounts.find((a) => a.id === t.accountId);
        const isIncome = t.type === "income";
        const isTransfer = t.type === "transfer";
        const target = accounts.find((a) => a.id === t.toAccountId);
        return (
          <button
            className="transaction-row"
            key={t.id}
            onClick={() => openDetails(t)}
            type="button"
          >
            <TransactionIcon
              color={category?.color}
              icon={isTransfer ? "transfer" : category?.icon}
            />
            <div className="tx-main">
              <b>{t.name}</b>
              <span>
                {t.detail ||
                  (isTransfer ? "Transfer" : category?.name || "Uncategorized")}
              </span>
            </div>
            <div className="tx-meta">
              <b>
                {accountLabel(account)}
                {isTransfer && ` → ${accountLabel(target)}`}
              </b>
              <span>
                {formatDayShort(t.date)}, {t.time}
              </span>
            </div>
            <Badge>
              {isTransfer ? "Transfer" : (category?.name ?? "Uncategorized")}
            </Badge>
            <div
              className={`amount ${isIncome ? "positive" : ""} ${isTransfer ? "neutral" : ""}`}
            >
              <b>
                {formatRupiah(isIncome || isTransfer ? t.amount : -t.amount)}
              </b>
              <span>{statusLabels[t.status]}</span>
            </div>
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        );
      })}
    </div>
  );
}
