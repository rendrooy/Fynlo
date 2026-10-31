"use client";

import type { TransactionInterface } from "@fynlo/types";

import { Badge } from "@fynlo/ui/components/badge";
import { Button } from "@fynlo/ui/components/button";
import { Dialog } from "@fynlo/ui/components/modal";
import {
  ArrowLeftRight,
  Calendar,
  Info,
  Link2,
  ListFilter,
  type LucideIcon,
  Pencil,
  Trash2,
  Wallet,
  X,
} from "lucide-react";

import { sourceLabels, statusLabels } from "@/constants";
import { useFinance } from "@/providers/finance-provider";
import { ApiError } from "@/services/api";
import { accountLabel } from "@/utils/finance";
import { formatDayShort, formatRupiah } from "@/utils/format";

export function TransactionDrawer({
  id,
  onClose,
  onEdit,
  toast,
}: {
  id: null | string;
  onClose: () => void;
  onEdit: (transaction: TransactionInterface) => void;
  toast: (message: string, isError?: boolean) => void;
}) {
  const {
    accounts,
    categories,
    deleteTransaction,
    transactions,
    updateTransaction,
  } = useFinance();
  const transaction = transactions.find((t) => t.id === id);
  const account = accounts.find((a) => a.id === transaction?.accountId);
  const category = categories.find((c) => c.id === transaction?.categoryId);
  const isIncome = transaction?.type === "income";
  const isTransfer = transaction?.type === "transfer";
  const target = accounts.find((a) => a.id === transaction?.toAccountId);

  const rows: [LucideIcon, string, string][] = transaction
    ? [
        [
          Calendar,
          "Date & time",
          `${formatDayShort(transaction.date)}, ${transaction.time}`,
        ],
        ...(isTransfer
          ? ([
              [Wallet, "From", accountLabel(account)],
              [Wallet, "To", accountLabel(target)],
            ] as [LucideIcon, string, string][])
          : ([
              [Wallet, "Account", accountLabel(account)],
              [ListFilter, "Category", category?.name ?? "Uncategorized"],
            ] as [LucideIcon, string, string][])),
        [
          ArrowLeftRight,
          "Type",
          isTransfer ? "Transfer" : isIncome ? "Income" : "Expense",
        ],
        [Link2, "Data source", sourceLabels[transaction.source]],
        [Info, "Note", transaction.detail || "-"],
      ]
    : [];

  return (
    <Dialog className="drawer" onClose={onClose} open={Boolean(transaction)}>
      {transaction && (
        <>
          <div className="drawer-head">
            <div>
              <span>TRANSACTION DETAILS</span>
              <h2>{transaction.name}</h2>
            </div>
            <button
              aria-label="Close"
              className="icon-btn"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" size={20} />
            </button>
          </div>
          <div className={`drawer-amount ${isIncome ? "positive" : ""}`}>
            <span>Transaction amount</span>
            <strong>
              {formatRupiah(
                isIncome || isTransfer
                  ? transaction.amount
                  : -transaction.amount,
              )}
            </strong>
            <Badge
              tone={transaction.status === "verified" ? "success" : "warning"}
            >
              {statusLabels[transaction.status]}
            </Badge>
          </div>
          <div className="detail-list">
            {rows.map(([Icon, label, value]) => (
              <div key={label}>
                <Icon aria-hidden="true" size={18} />
                <span>{label}</span>
                <b>{value}</b>
              </div>
            ))}
          </div>
          <div className="source-note">
            <Info aria-hidden="true" size={18} />
            <span>
              This transaction came from {sourceLabels[transaction.source]}. Its
              status does not mean your bank has verified it directly.
            </span>
          </div>
          {transaction.isNotDuplicate && (
            <div className="source-note">
              <Info aria-hidden="true" size={18} />
              <span>
                You marked this as not a duplicate.{" "}
                <button
                  className="text-link"
                  onClick={() => {
                    updateTransaction(transaction.id, {
                      isNotDuplicate: false,
                    }).catch((error: unknown) =>
                      toast(
                        error instanceof ApiError
                          ? error.message
                          : "Please try again.",
                        true,
                      ),
                    );
                  }}
                  type="button"
                >
                  Check again
                </button>
              </span>
            </div>
          )}
          <div className="drawer-actions">
            <Button
              kind="secondary"
              onClick={() => {
                deleteTransaction(transaction.id)
                  .then(() => {
                    onClose();
                    toast("Transaction deleted");
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
              <Trash2 aria-hidden="true" size={17} />
              Delete
            </Button>
            <Button onClick={() => onEdit(transaction)}>
              <Pencil aria-hidden="true" size={17} />
              Edit Transaction
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
