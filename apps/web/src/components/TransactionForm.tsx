"use client";

import type { TransactionInterface, TransactionType } from "@fynlo/types";

import { Button } from "@fynlo/ui/components/button";
import { Info } from "lucide-react";
import { type FormEvent, useState } from "react";

import { useFinance } from "@/providers/finance-provider";
import { accountLabel } from "@/utils/finance";
import { formatGrouped, toIsoDate } from "@/utils/format";

import { CategoryOptions } from "./CategoryOptions";

export function TransactionForm({
  defaultType = "expense",
  editing,
  onCancel,
  onSaved,
}: {
  defaultType?: TransactionType;
  editing?: TransactionInterface;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const {
    accounts,
    accountsStatus,
    addTransaction,
    categories,
    updateTransaction,
  } = useFinance();
  const [type, setType] = useState(editing?.type ?? defaultType);
  const [name, setName] = useState(editing?.name ?? "");
  const [amount, setAmount] = useState(editing?.amount ?? 0);
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");
  const [accountId, setAccountId] = useState(
    editing?.accountId ?? accounts[0]?.id ?? "",
  );
  const [date, setDate] = useState(editing?.date ?? toIsoDate(new Date()));
  const [detail, setDetail] = useState(editing?.detail ?? "");
  const [submitted, setSubmitted] = useState(false);

  const options = categories.filter((c) => c.type === type);

  function changeType(next: TransactionType) {
    setType(next);
    setCategoryId("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (amount <= 0 || !accountId || !categoryId || !date) return;
    const categoryName = categories.find((c) => c.id === categoryId)?.name;
    const values = {
      accountId,
      amount,
      categoryId,
      date,
      detail: detail.trim(),
      name: name.trim() || categoryName || "Transaction",
      type,
    };
    if (editing) {
      updateTransaction(editing.id, values);
      onSaved("Transaction updated");
    } else {
      const now = new Date();
      addTransaction({
        ...values,
        source: "manual",
        status: "verified",
        time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      });
      onSaved("Transaction added");
    }
  }

  return (
    <form noValidate onSubmit={submit}>
      {accountsStatus === "ready" && accounts.length === 0 && (
        <div className="notice">
          <Info aria-hidden="true" size={20} />
          <div>
            <b>Add an account first</b>
            <span>Every transaction has to belong to an account.</span>
          </div>
        </div>
      )}
      <div aria-label="Transaction type" className="type-tabs" role="group">
        {(["expense", "income"] as const).map((option) => (
          <button
            aria-pressed={type === option}
            className={type === option ? "active" : undefined}
            key={option}
            onClick={() => changeType(option)}
            type="button"
          >
            {option === "expense" ? "Expense" : "Income"}
          </button>
        ))}
      </div>

      <label>
        Description
        <input
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          placeholder="Example: Lunch"
          value={name}
        />
      </label>

      <div className="form-grid">
        <label>
          Amount
          <input
            autoComplete="off"
            autoFocus
            inputMode="numeric"
            onChange={(event) =>
              setAmount(
                Number(event.target.value.replace(/\D/g, "").slice(0, 13)),
              )
            }
            placeholder="Rp0"
            value={amount ? `Rp${formatGrouped(amount)}` : ""}
          />
          {submitted && amount <= 0 && (
            <span className="field-error">Enter an amount greater than 0</span>
          )}
        </label>
        <label>
          Date
          <input
            onChange={(event) => setDate(event.target.value)}
            type="date"
            value={date}
          />
        </label>
        <label>
          Account
          <select
            onChange={(event) => setAccountId(event.target.value)}
            value={accountId}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {accountLabel(account)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select
            onChange={(event) => setCategoryId(event.target.value)}
            value={categoryId}
          >
            <option value="">Choose a category</option>
            <CategoryOptions categories={options} />
          </select>
          {submitted && !categoryId && (
            <span className="field-error">Choose a category</span>
          )}
        </label>
      </div>

      <label>
        Note (optional)
        <textarea
          maxLength={120}
          onChange={(event) => setDetail(event.target.value)}
          placeholder="Add a note..."
          value={detail}
        />
      </label>

      <div className="modal-actions">
        <Button kind="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={accounts.length === 0} type="submit">
          Save Transaction
        </Button>
      </div>
    </form>
  );
}
