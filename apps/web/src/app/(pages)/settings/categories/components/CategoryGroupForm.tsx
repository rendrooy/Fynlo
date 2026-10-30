"use client";

import type { CategoryGroupInterface, TransactionType } from "@fynlo/types";

import { Button } from "@fynlo/ui/components/button";
import { type FormEvent, useState } from "react";

import { useFinance } from "@/providers/finance-provider";
import { ApiError } from "@/services/api";

export function CategoryGroupForm({
  editing,
  onCancel,
  onSaved,
  type,
}: {
  editing?: CategoryGroupInterface;
  onCancel: () => void;
  onSaved: (message: string) => void;
  type: TransactionType;
}) {
  const { createCategoryGroup, renameCategoryGroup } = useFinance();
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
        await renameCategoryGroup(editing.id, name.trim());
        onSaved("Group renamed");
      } else {
        await createCategoryGroup(name.trim(), type);
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
          placeholder="Example: Savings"
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
