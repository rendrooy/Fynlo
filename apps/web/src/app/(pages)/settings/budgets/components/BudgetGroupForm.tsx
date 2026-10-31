"use client";

import type { BudgetGroupInterface } from "@fynlo/types";

import { Button } from "@fynlo/ui/components/button";
import { type FormEvent, useState } from "react";

import { useFinance } from "@/providers/finance-provider";
import { ApiError } from "@/services/api";

export function BudgetGroupForm({
  editing,
  onCancel,
  onSaved,
}: {
  editing?: BudgetGroupInterface;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const { createBudgetGroup, renameBudgetGroup } = useFinance();
  const [name, setName] = useState(editing?.name ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a group name");
      return;
    }
    setError("");
    setSaving(true);
    try {
      if (editing) {
        await renameBudgetGroup(editing.id, name.trim());
        onSaved("Group renamed");
      } else {
        await createBudgetGroup(name.trim());
        onSaved("Group added");
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
        Group name
        <input
          autoFocus
          maxLength={50}
          onChange={(event) => setName(event.target.value)}
          placeholder="Example: Family"
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
          {saving ? "Saving..." : "Save Group"}
        </Button>
      </div>
    </form>
  );
}
