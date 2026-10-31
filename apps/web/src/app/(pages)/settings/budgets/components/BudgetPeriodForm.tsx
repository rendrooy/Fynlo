"use client";

import type { BudgetPeriodInterface, BudgetPeriodUnit } from "@fynlo/types";

import { Button } from "@fynlo/ui/components/button";
import { Select } from "@fynlo/ui/components/select";
import { type FormEvent, useState } from "react";

import { useFinance } from "@/providers/finance-provider";
import { ApiError } from "@/services/api";
import { toIsoDate } from "@/utils/format";

const UNITS: { label: string; value: BudgetPeriodUnit }[] = [
  { label: "Days", value: "day" },
  { label: "Weeks", value: "week" },
  { label: "Months", value: "month" },
  { label: "Years", value: "year" },
  { label: "Once (fixed dates)", value: "once" },
];

export function BudgetPeriodForm({
  editing,
  onCancel,
  onSaved,
}: {
  editing?: BudgetPeriodInterface;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const { createBudgetPeriod, updateBudgetPeriod } = useFinance();
  const [name, setName] = useState(editing?.name ?? "");
  const [unit, setUnit] = useState<BudgetPeriodUnit>(editing?.unit ?? "month");
  const [intervalCount, setIntervalCount] = useState(
    editing?.intervalCount ?? 1,
  );
  const [startDate, setStartDate] = useState(
    editing?.startDate ?? toIsoDate(new Date()),
  );
  const [endDate, setEndDate] = useState(editing?.endDate ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isOnce = unit === "once";
  const endInvalid = isOnce && (!endDate || endDate < startDate);
  const intervalInvalid = !isOnce && (intervalCount < 1 || intervalCount > 365);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!name.trim() || !startDate || endInvalid || intervalInvalid) return;
    const input = {
      endDate: isOnce ? endDate : null,
      intervalCount: isOnce ? 1 : intervalCount,
      name: name.trim(),
      startDate,
      unit,
    };
    setError("");
    setSaving(true);
    try {
      if (editing) {
        await updateBudgetPeriod(editing.id, input);
        onSaved("Period updated");
      } else {
        await createBudgetPeriod(input);
        onSaved("Period added");
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
        Period name
        <input
          autoFocus
          maxLength={50}
          onChange={(event) => setName(event.target.value)}
          placeholder="Example: Payday cycle"
          value={name}
        />
        {submitted && !name.trim() && (
          <span className="field-error">Enter a period name</span>
        )}
      </label>
      <div className="form-grid">
        <label>
          Repeats
          <Select
            onChange={(value) => setUnit(value as BudgetPeriodUnit)}
            options={UNITS}
            value={unit}
          />
        </label>
        {!isOnce && (
          <label>
            Every
            <input
              inputMode="numeric"
              onChange={(event) =>
                setIntervalCount(
                  Number(event.target.value.replace(/\D/g, "").slice(0, 3)),
                )
              }
              value={intervalCount || ""}
            />
            {submitted && intervalInvalid && (
              <span className="field-error">Enter 1 to 365</span>
            )}
          </label>
        )}
      </div>
      <div className="form-grid">
        <label>
          {isOnce ? "Start date" : "First period starts"}
          <input
            onChange={(event) => setStartDate(event.target.value)}
            type="date"
            value={startDate}
          />
          {submitted && !startDate && (
            <span className="field-error">Choose a date</span>
          )}
        </label>
        {isOnce && (
          <label>
            End date
            <input
              onChange={(event) => setEndDate(event.target.value)}
              type="date"
              value={endDate}
            />
            {submitted && endInvalid && (
              <span className="field-error">
                Choose a date on or after the start
              </span>
            )}
          </label>
        )}
      </div>
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
          {saving ? "Saving..." : "Save Period"}
        </Button>
      </div>
    </form>
  );
}
