"use client";

import type { TransactionInterface, TransactionType } from "@fynlo/types";

import { Button } from "@fynlo/ui/components/button";
import { Select } from "@fynlo/ui/components/select";
import { Info } from "lucide-react";
import { type FormEvent, useState } from "react";

import { useFinance } from "@/providers/finance-provider";
import { ApiError } from "@/services/api";
import { categoryOptions } from "@/utils/category-options";
import { accountLabel } from "@/utils/finance";
import { formatGrouped, toIsoDate } from "@/utils/format";

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
  const [chosenAccountId, setAccountId] = useState(editing?.accountId ?? "");
  // Accounts may finish loading after the form opens, so the default is derived.
  const accountId = chosenAccountId || (accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(editing?.toAccountId ?? "");
  const [date, setDate] = useState(editing?.date ?? toIsoDate(new Date()));
  const [detail, setDetail] = useState(editing?.detail ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isTransfer = type === "transfer";
  const options = categories.filter((c) => c.type === type);
  const sameAccount = isTransfer && toAccountId === accountId;
  const targetMissing = isTransfer && (!toAccountId || sameAccount);

  function changeType(next: TransactionType) {
    setType(next);
    setCategoryId("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (
      amount <= 0 ||
      !accountId ||
      !date ||
      targetMissing ||
      (!isTransfer && !categoryId)
    ) {
      return;
    }
    const categoryName = categories.find((c) => c.id === categoryId)?.name;
    const now = new Date();
    const values = {
      accountId,
      amount,
      ...(isTransfer ? { toAccountId } : { categoryId }),
      date,
      detail: detail.trim(),
      name:
        name.trim() ||
        (isTransfer ? "Transfer" : categoryName) ||
        "Transaction",
      time:
        editing?.time ??
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    };
    setError("");
    setSaving(true);
    try {
      if (editing) {
        await updateTransaction(editing.id, values);
        onSaved("Transaction updated");
      } else {
        await addTransaction(values);
        onSaved("Transaction added");
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Something went wrong. Please try again.",
      );
      setSaving(false);
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
      <div
        aria-label="Transaction type"
        className="type-tabs three"
        role="group"
      >
        {(["expense", "income", "transfer"] as const).map((option) => (
          <button
            aria-pressed={type === option}
            className={type === option ? "active" : undefined}
            key={option}
            onClick={() => changeType(option)}
            type="button"
          >
            {option === "expense"
              ? "Expense"
              : option === "income"
                ? "Income"
                : "Transfer"}
          </button>
        ))}
      </div>

      <label>
        Description
        <input
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          placeholder={isTransfer ? "Example: Top up" : "Example: Lunch"}
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
          {isTransfer ? "From account" : "Account"}
          <Select
            onChange={setAccountId}
            options={accounts.map((account) => ({
              label: accountLabel(account),
              value: account.id,
            }))}
            placeholder="Choose an account"
            value={accountId}
          />
        </label>
        {isTransfer ? (
          <label>
            To account
            <Select
              onChange={setToAccountId}
              options={accounts
                .filter((account) => account.id !== accountId)
                .map((account) => ({
                  label: accountLabel(account),
                  value: account.id,
                }))}
              placeholder="Choose an account"
              value={toAccountId === accountId ? "" : toAccountId}
            />
            {submitted && targetMissing && (
              <span className="field-error">
                {accounts.length < 2
                  ? "Add a second account first"
                  : "Choose a different account"}
              </span>
            )}
          </label>
        ) : (
          <label>
            Category
            <Select
              onChange={setCategoryId}
              options={categoryOptions(options)}
              placeholder="Choose a category"
              value={categoryId}
            />
            {submitted && !categoryId && (
              <span className="field-error">Choose a category</span>
            )}
          </label>
        )}
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

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <div className="modal-actions">
        <Button kind="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={saving || accounts.length === 0} type="submit">
          {saving ? "Saving..." : "Save Transaction"}
        </Button>
      </div>
    </form>
  );
}
