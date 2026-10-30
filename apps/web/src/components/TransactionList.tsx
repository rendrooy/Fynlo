"use client";

import type { TransactionInterface } from "@fynlo/types";

import { Badge } from "@fynlo/ui/components/badge";
import { ChevronRight } from "lucide-react";

import { statusLabels } from "@/constants";
import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";
import { formatDayShort, formatRupiah } from "@/utils/format";

import { CategoryIcon } from "./CategoryIcon";

export function TransactionList({ items }: { items: TransactionInterface[] }) {
  const { accounts, categories } = useFinance();
  const { openDetails } = useTransactionSheet();

  return (
    <div className="transaction-list">
      {items.map((t) => {
        const category = categories.find((c) => c.id === t.categoryId);
        const account = accounts.find((a) => a.id === t.accountId);
        const isIncome = t.type === "income";
        return (
          <button
            className="transaction-row"
            key={t.id}
            onClick={() => openDetails(t)}
            type="button"
          >
            <div className={`tx-icon cat-${category?.icon}`}>
              <CategoryIcon icon={category?.icon ?? ""} />
            </div>
            <div className="tx-main">
              <b>{t.name}</b>
              <span>{t.detail || category?.name}</span>
            </div>
            <div className="tx-meta">
              <b>
                {account?.name} •• {account?.mask}
              </b>
              <span>
                {formatDayShort(t.date)}, {t.time}
              </span>
            </div>
            <Badge>{category?.name}</Badge>
            <div className={`amount ${isIncome ? "positive" : ""}`}>
              <b>{formatRupiah(isIncome ? t.amount : -t.amount)}</b>
              <span>{statusLabels[t.status]}</span>
            </div>
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        );
      })}
    </div>
  );
}
