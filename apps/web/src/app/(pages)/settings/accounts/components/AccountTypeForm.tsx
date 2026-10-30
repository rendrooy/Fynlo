"use client";

import type { AccountTypeInterface } from "@fynlo/types";

import { Button } from "@fynlo/ui/components/button";
import { type FormEvent, useState } from "react";

import { useFinance } from "@/providers/finance-provider";
import { ApiError } from "@/services/api";

export function AccountTypeForm({
  editing,
  onCancel,
  onSaved,
}: {
  editing?: AccountTypeInterface;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const { createAccountType, renameAccountType } = useFinance();
  const [name, setName] = useState(editing?.name ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a type name");
      return;
    }
    setError("");
    setSaving(true);
    try {
      if (editing) {
        await renameAccountType(editing.id, name.trim());
        onSaved("Account type renamed");
      } else {
        await createAccountType(name.trim());
        onSaved("Account type added");
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
        Type name
        <input
          autoFocus
          maxLength={50}
          onChange={(event) => setName(event.target.value)}
          placeholder="Example: Credit card"
          value={name}
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
        <Button disabled={saving} type="submit">
          {saving ? "Saving..." : "Save Type"}
        </Button>
      </div>
    </form>
  );
}
