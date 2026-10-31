"use client";

import type { AccountInterface } from "@fynlo/types";

import { Button } from "@fynlo/ui/components/button";
import { Select } from "@fynlo/ui/components/select";
import { type FormEvent, useState } from "react";

import { ColorPicker, COLORS } from "@/components/ColorPicker";
import { useFinance } from "@/providers/finance-provider";
import { ApiError } from "@/services/api";
import { formatGrouped } from "@/utils/format";

export function AccountForm({
  defaultMask,
  defaultName,
  editing,
  onCancel,
  onSaved,
}: {
  defaultMask?: null | string;
  defaultName?: string;
  editing?: AccountInterface;
  onCancel: () => void;
  onSaved: (message: string, created?: AccountInterface) => void;
}) {
  const { accountTypes, createAccount, updateAccount } = useFinance();
  const [name, setName] = useState(editing?.name ?? defaultName ?? "");
  const [accountTypeId, setAccountTypeId] = useState(
    editing?.accountTypeId ?? accountTypes[0]?.id ?? "",
  );
  const [mask, setMask] = useState(editing?.mask ?? defaultMask ?? "");
  const [color, setColor] = useState<string>(editing?.color ?? COLORS[0]);
  const [balance, setBalance] = useState(editing?.openingBalance ?? 0);
  const [negative, setNegative] = useState((editing?.openingBalance ?? 0) < 0);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const nameError = submitted && !name.trim();
  const maskError = submitted && mask !== "" && mask.length !== 4;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!name.trim() || !accountTypeId || (mask !== "" && mask.length !== 4)) {
      return;
    }
    const input = {
      accountTypeId,
      color,
      mask: mask || null,
      name: name.trim(),
      openingBalance: negative ? -Math.abs(balance) : Math.abs(balance),
    };
    setError("");
    setSaving(true);
    try {
      if (editing) {
        await updateAccount(editing.id, input);
        onSaved("Account updated");
      } else {
        onSaved("Account added", await createAccount(input));
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
      <label>
        Account name
        <input
          autoFocus
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          placeholder="Example: BCA Savings"
          value={name}
        />
        {nameError && (
          <span className="field-error">Enter an account name</span>
        )}
      </label>

      <div className="form-grid">
        <label>
          Type
          <Select
            onChange={setAccountTypeId}
            options={accountTypes.map((type) => ({
              label: type.name,
              value: type.id,
            }))}
            placeholder="Add a type first"
            value={accountTypeId}
          />
          {submitted && !accountTypeId && (
            <span className="field-error">Add an account type first</span>
          )}
        </label>
        <label>
          Last 4 digits (optional)
          <input
            autoComplete="off"
            inputMode="numeric"
            maxLength={4}
            onChange={(event) => setMask(event.target.value.replace(/\D/g, ""))}
            placeholder="1234"
            value={mask}
          />
          {maskError && <span className="field-error">Enter 4 digits</span>}
        </label>
      </div>

      <label>
        Opening balance
        <input
          autoComplete="off"
          inputMode="numeric"
          onChange={(event) =>
            setBalance(
              Number(event.target.value.replace(/\D/g, "").slice(0, 14)),
            )
          }
          placeholder="Rp0"
          value={balance ? `Rp${formatGrouped(Math.abs(balance))}` : ""}
        />
      </label>
      <label className="checkbox-field">
        <input
          checked={negative}
          onChange={(event) => setNegative(event.target.checked)}
          type="checkbox"
        />
        This balance is negative (for example, an overdraft)
      </label>

      <ColorPicker onChange={setColor} value={color} />

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <div className="modal-actions">
        <Button kind="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={saving} type="submit">
          {saving ? "Saving..." : "Save Account"}
        </Button>
      </div>
    </form>
  );
}
