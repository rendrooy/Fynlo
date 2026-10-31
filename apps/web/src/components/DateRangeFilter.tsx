"use client";

import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  type DateRange,
  type DateRangePreset,
  resolveDateRange,
} from "@/utils/finance";
import { toIsoDate } from "@/utils/format";

export const DATE_RANGE_PRESETS: {
  label: string;
  value: DateRangePreset;
}[] = [
  { label: "This month", value: "this-month" },
  { label: "Last month", value: "last-month" },
  { label: "Last 30 days", value: "last-30" },
  { label: "Last 90 days", value: "last-90" },
  { label: "This year", value: "this-year" },
  { label: "All time", value: "all" },
  { label: "Custom range", value: "custom" },
];

export function currentMonthToDate() {
  const now = new Date();
  return {
    from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toIsoDate(now),
  };
}

export function DateRangeFilter({
  custom,
  onCustomChange,
  onPresetChange,
  preset,
  range,
}: {
  custom: DateRange;
  onCustomChange: (custom: DateRange) => void;
  onPresetChange: (preset: DateRangePreset) => void;
  preset: DateRangePreset;
  range: DateRange;
}) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const current = DATE_RANGE_PRESETS.find((p) => p.value === preset);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(value: DateRangePreset) {
    onPresetChange(value);
    // A custom range still needs its dates, so the panel stays open for it.
    if (value === "custom") return;
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div className="date-filter" ref={root}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Date range: ${current?.label}`}
        className={`date-filter-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen(!open)}
        ref={trigger}
        type="button"
      >
        <CalendarDays aria-hidden="true" size={16} />
        <b>{current?.label}</b>
        <span>{formatRange(range)}</span>
        <ChevronDown aria-hidden="true" size={16} />
      </button>
      {open && (
        <div
          aria-label="Date range"
          className="date-filter-panel"
          role="dialog"
        >
          <div className="date-filter-options">
            {DATE_RANGE_PRESETS.map((option) => (
              <button
                aria-pressed={option.value === preset}
                key={option.value}
                onClick={() => choose(option.value)}
                type="button"
              >
                <b>{option.label}</b>
                <span>{describe(option.value, custom)}</span>
                {option.value === preset && (
                  <Check aria-hidden="true" size={15} />
                )}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="date-filter-custom">
              <label>
                From
                <input
                  aria-label="From date"
                  onChange={(event) =>
                    event.target.value &&
                    onCustomChange({ ...custom, from: event.target.value })
                  }
                  type="date"
                  value={custom.from}
                />
              </label>
              <label>
                To
                <input
                  aria-label="To date"
                  onChange={(event) =>
                    event.target.value &&
                    onCustomChange({ ...custom, to: event.target.value })
                  }
                  type="date"
                  value={custom.to}
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function describe(preset: DateRangePreset, custom: DateRange) {
  if (preset === "all") return "Every transaction";
  if (preset === "custom") return "Pick your own dates";
  return formatRange(resolveDateRange(preset, custom, []).range);
}

function formatRange({ from, to }: DateRange) {
  return `${formatRangeDate(from)} – ${formatRangeDate(to)}`;
}

function formatRangeDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
