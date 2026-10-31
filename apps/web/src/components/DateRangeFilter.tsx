"use client";

import { Select } from "@fynlo/ui/components/select";

import type { DateRange, DateRangePreset } from "@/utils/finance";

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
  return (
    <div className="dashboard-filter">
      <div className="dashboard-filter-preset">
        <Select
          aria-label="Date range"
          onChange={(value) => onPresetChange(value as DateRangePreset)}
          options={DATE_RANGE_PRESETS}
          value={preset}
        />
      </div>
      {preset === "custom" ? (
        <div className="dashboard-filter-dates">
          <input
            aria-label="From date"
            onChange={(event) =>
              event.target.value &&
              onCustomChange({ ...custom, from: event.target.value })
            }
            type="date"
            value={custom.from}
          />
          <span>to</span>
          <input
            aria-label="To date"
            onChange={(event) =>
              event.target.value &&
              onCustomChange({ ...custom, to: event.target.value })
            }
            type="date"
            value={custom.to}
          />
        </div>
      ) : (
        <span className="dashboard-filter-label">
          {formatRangeDate(range.from)} – {formatRangeDate(range.to)}
        </span>
      )}
    </div>
  );
}

function formatRangeDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
