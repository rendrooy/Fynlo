"use client";

import type { AccountInterface } from "@fynlo/types";

import { Button } from "@fynlo/ui/components/button";
import { type FormEvent, useState } from "react";

import { useFinance } from "@/providers/finance-provider";
import { ApiError } from "@/services/api";
import { accountBalance } from "@/utils/finance";
import { formatRupiah, toIsoDate } from "@/utils/format";

export function AdjustBalanceForm({
  account,
  onCancel,
  onSaved,
}: {
  account: AccountInterface;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const { adjustBalance, transactions } = useFinance();
  const today = toIsoDate(new Date());
  const [text, setText] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const current = accountBalance(account, transactions, date);
  const target = parseBalance(text);
  const difference =
    target === null ? null : Math.round((target - current) * 100) / 100;
  const isPast = date < today;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (target === null || !difference || !date || date > today) return;
    setError("");
    setSaving(true);
    try {
      await adjustBalance(account.id, { balance: target, date, note });
      onSaved("Balance adjusted");
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
      <div className="adjust-current">
        <span>Balance in Fynlo</span>
        <b>{formatRupiah(current)}</b>
      </div>
      <div className="form-grid">
        <label>
          Actual balance
          <input
            autoComplete="off"
            autoFocus
            inputMode="decimal"
            onChange={(event) => setText(event.target.value)}
            placeholder="Example: 41.100"
            value={text}
          />
          {text !== "" && target === null && (
            <span className="field-error">Enter a valid amount</span>
          )}
        </label>
        <label>
          On date
          <input
            max={today}
            onChange={(event) => setDate(event.target.value)}
            type="date"
            value={date}
          />
        </label>
      </div>
      <label>
        Note (optional)
        <textarea
          maxLength={120}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Why the balance differs"
          value={note}
        />
      </label>

      {difference !== null && difference !== 0 && (
        <div className="notice">
          <div>
            <b>
              {formatRupiah(Math.abs(difference))} will be recorded as{" "}
              {difference > 0 ? "income" : "an expense"}
            </b>
            <span>
              Category: Difference. It counts in your totals, and deleting it
              undoes the change.
              {isPast && " Later balances will move by the same amount."}
            </span>
          </div>
        </div>
      )}
      {difference === 0 && (
        <p className="import-note">This balance already matches.</p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <div className="modal-actions">
        <Button kind="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={saving || target === null || !difference}
          type="submit"
        >
          {saving ? "Saving..." : "Adjust Balance"}
        </Button>
      </div>
    </form>
  );
}

/** Reads "1.250.000,50" the way it's written in Rupiah. */
function parseBalance(text: string) {
  const clean = text
    .replace(/\s|rp/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Number(clean);
}
