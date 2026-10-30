const compact = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
  notation: "compact",
});

const grouped = new Intl.NumberFormat("id-ID");

export const formatRupiah = (value: number) =>
  `${value < 0 ? "-" : ""}Rp${grouped.format(Math.abs(value))}`;

export const formatSigned = (value: number) =>
  `${value >= 0 ? "+" : ""}${formatRupiah(value)}`;

export const formatCompact = (value: number) => compact.format(value);

export const formatGrouped = (value: number) => grouped.format(value);

/** Converts a Date to YYYY-MM-DD in the local time zone. */
export function toIsoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** YYYY-MM-DD must be read as local time so the date does not shift. */
export const parseIsoDate = (iso: string) => new Date(`${iso}T00:00:00`);

export const monthKey = (date: Date) => toIsoDate(date).slice(0, 7);

export const formatMonth = (date: Date) =>
  date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

export const formatMonthShort = (date: Date) =>
  date.toLocaleDateString("en-GB", { month: "short" });

export const formatDayShort = (iso: string) =>
  parseIsoDate(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
