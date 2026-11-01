"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";

import type { DateRange } from "@/utils/finance";

import { formatMonth, parseIsoDate, toIsoDate } from "@/utils/format";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const KEY_STEPS: Record<string, number> = {
  ArrowDown: 7,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
};

const formatDay = (iso: string) =>
  parseIsoDate(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** The first click starts a range and the second finishes it, in either order. */
export function DateRangeCalendar({
  onChange,
  range,
}: {
  onChange: (range: DateRange) => void;
  range: DateRange;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const [month, setMonth] = useState(() => {
    const end = parseIsoDate(range.to);
    return new Date(end.getFullYear(), end.getMonth(), 1);
  });
  // Nothing changes on the page until the range is whole.
  const [start, setStart] = useState<null | string>(null);
  const [hovered, setHovered] = useState<null | string>(null);

  const today = toIsoDate(new Date());
  const lead = (month.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) =>
    toIsoDate(
      new Date(month.getFullYear(), month.getMonth(), index - lead + 1),
    ),
  );
  const other = start ? (hovered ?? start) : null;
  const shown =
    start && other
      ? {
          from: start < other ? start : other,
          to: start < other ? other : start,
        }
      : range;

  function pick(date: string) {
    if (!start) {
      setStart(date);
      return;
    }
    setStart(null);
    setHovered(null);
    onChange(
      date < start ? { from: date, to: start } : { from: start, to: date },
    );
  }

  function shift(months: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + months, 1));
  }

  function onKeyDown(event: KeyboardEvent) {
    const step = KEY_STEPS[event.key];
    const date = (event.target as HTMLElement).dataset.date;
    if (!step || !date) return;
    event.preventDefault();
    const moved = parseIsoDate(date);
    moved.setDate(moved.getDate() + step);
    const iso = toIsoDate(moved);
    if (start) setHovered(iso);
    const focus = () =>
      grid.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${iso}"]`)
        ?.focus();
    if (days.includes(iso)) {
      focus();
      return;
    }
    // Past the visible weeks, the next month has to appear first.
    setMonth(new Date(moved.getFullYear(), moved.getMonth(), 1));
    requestAnimationFrame(focus);
  }

  return (
    <div className="range-calendar">
      <div aria-live="polite" className="range-calendar-ends">
        <span className={start ? "active" : undefined}>
          <small>From</small>
          <b>{formatDay(shown.from)}</b>
        </span>
        <i aria-hidden="true" />
        <span className={start ? undefined : "idle"}>
          <small>To</small>
          <b>{start && !hovered ? "Choose end date" : formatDay(shown.to)}</b>
        </span>
      </div>
      <div className="range-calendar-nav">
        <button
          aria-label="Previous year"
          onClick={() => shift(-12)}
          type="button"
        >
          <ChevronsLeft aria-hidden="true" size={16} />
        </button>
        <button
          aria-label="Previous month"
          onClick={() => shift(-1)}
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={16} />
        </button>
        <b>{formatMonth(month)}</b>
        <button aria-label="Next month" onClick={() => shift(1)} type="button">
          <ChevronRight aria-hidden="true" size={16} />
        </button>
        <button aria-label="Next year" onClick={() => shift(12)} type="button">
          <ChevronsRight aria-hidden="true" size={16} />
        </button>
      </div>
      <div aria-hidden="true" className="range-calendar-head">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div
        className="range-calendar-grid"
        onKeyDown={onKeyDown}
        onPointerLeave={() => setHovered(null)}
        ref={grid}
      >
        {days.map((date) => {
          const isEnd = date === shown.from || date === shown.to;
          const classes = [
            parseIsoDate(date).getMonth() === month.getMonth() ? "" : "outside",
            date === today ? "today" : "",
            date > shown.from && date < shown.to ? "between" : "",
            isEnd ? "end" : "",
            shown.from !== shown.to && date === shown.from ? "first" : "",
            shown.from !== shown.to && date === shown.to ? "last" : "",
          ];
          return (
            <button
              aria-label={formatDay(date)}
              aria-pressed={isEnd}
              className={classes.filter(Boolean).join(" ")}
              data-date={date}
              key={date}
              onClick={() => pick(date)}
              onPointerEnter={() => start && setHovered(date)}
              type="button"
            >
              <span>{parseIsoDate(date).getDate()}</span>
            </button>
          );
        })}
      </div>
      <p className="range-calendar-hint">
        {start ? "Now choose the end date." : "Choose a start date."}
      </p>
    </div>
  );
}
