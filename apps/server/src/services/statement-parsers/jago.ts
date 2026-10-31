import type { PdfTextItem } from "./pdf-text";
import type {
  ParsedStatement,
  ParsedStatementRow,
  ParsedStatementSection,
} from "./types";

import { HttpError } from "../../utils/http-error";

const MONTHS: Record<string, string> = {
  agt: "08",
  apr: "04",
  aug: "08",
  dec: "12",
  des: "12",
  feb: "02",
  jan: "01",
  jul: "07",
  jun: "06",
  mar: "03",
  may: "05",
  mei: "05",
  nov: "11",
  oct: "10",
  okt: "10",
  sep: "09",
};

// Layout of Jago's "Laporan Keuangan Bulanan".
const HEADER_Y = 790;
const FOOTER_Y = 35;
const PAGE_OFFSET = 10000;
const SAME_LINE = 4;
const DATE_COLUMN_END = 60;
const NAME_COLUMN = [100, 200];
const DETAIL_COLUMN = [200, 295];
const NOTE_COLUMN = [295, 430];
const AMOUNT_COLUMN = [430, 490];
const BALANCE_COLUMN_START = 490;
const SUMMARY_LABEL_X = [310, 330];
// A tall row vertically centers its date, so its other columns can start above it.
const ROW_RISE = 9;
const MAX_ROW_NAME = 100;
const POCKET_RISE = 8;

const DATE = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/;
const TIME = /^(\d{2})\.(\d{2})$/;
const SIGNED_AMOUNT = /^[+-][\d.]+,\d{2}$/;
const AMOUNT = /^-?[\d.]+,\d{2}$/;
const POCKET_MOVE = /Uang Kantong/;
const POCKET_ID = /^ID Kantong (\d+)$/;

type Line = PdfTextItem & { position: number };

const unreadable = () =>
  new HttpError(
    422,
    "This statement doesn't match the Jago format Fynlo can read reliably",
  );

const toCents = (text: string) =>
  Math.round(Number(text.replace(/[+.]/g, "").replace(",", ".")) * 100);

const inColumn = (x: number, [start, end]: number[]) =>
  x >= (start as number) && x < (end as number);

/** Parses a Jago statement, one section per pocket, and refuses it unless every balance adds up. */
export function parseJago(items: PdfTextItem[]): ParsedStatement {
  if (
    !items.some((item) => item.text === "Laporan Keuangan Bulanan") ||
    !items.some((item) => item.text === "www.jago.com")
  ) {
    throw new HttpError(
      422,
      items.length === 0
        ? "This PDF has no readable text, so it may be a scan"
        : "This doesn't look like a Jago statement",
    );
  }

  // A running position lets a pocket or transaction continue across a page break.
  const lines: Line[] = items
    .filter((item) => item.y < HEADER_Y && item.y > FOOTER_Y)
    .map((item) => ({ ...item, position: item.page * PAGE_OFFSET - item.y }))
    .sort((a, b) => a.position - b.position || a.x - b.x);

  const pockets = lines.flatMap((line) => {
    const id = line.text.match(POCKET_ID)?.[1];
    if (!id || line.x > DATE_COLUMN_END) return [];
    const title = lines
      .filter(
        (other) =>
          other.x < DATE_COLUMN_END &&
          other.position < line.position &&
          line.position - other.position < 30,
      )
      .at(-1);
    if (!title) throw unreadable();
    return [{ id, name: title.text, position: title.position }];
  });
  if (pockets.length === 0) throw unreadable();
  const names = new Set(pockets.map((pocket) => pocket.name));
  const closingMarker = lines.find((line) => line.text === "INFO PENTING");

  const sections = pockets.map((pocket, index) => {
    // The next pocket's summary starts slightly above its title.
    const next = pockets[index + 1];
    const end =
      (next ? next.position - POCKET_RISE : undefined) ??
      closingMarker?.position ??
      Number.POSITIVE_INFINITY;
    return parsePocket(
      lines.filter(
        (line) =>
          line.position >= pocket.position - POCKET_RISE && line.position < end,
      ),
      pocket,
      names,
    );
  });

  checkTotalBalance(lines, sections);
  return { sections };
}

function checkTotalBalance(lines: Line[], sections: ParsedStatementSection[]) {
  const value = (label: string) => {
    const title = lines.find((line) => line.text === label);
    const found = lines.find(
      (line) =>
        title &&
        line.page === title.page &&
        Math.abs(line.position - title.position) < SAME_LINE &&
        AMOUNT.test(line.text),
    );
    if (!found) throw unreadable();
    return toCents(found.text);
  };
  const total = sections.reduce(
    (sum, section) => sum + Math.round(section.closingBalance * 100),
    0,
  );
  if (total !== value("Total Saldo Personal") + value("Total Saldo Bersama")) {
    throw unreadable();
  }
}

function parseDate(text: string) {
  const [, day, month, year] = text.match(DATE) ?? [];
  const monthNumber = MONTHS[(month ?? "").toLowerCase()];
  if (!day || !monthNumber || !year) throw unreadable();
  return `${year}-${monthNumber}-${day.padStart(2, "0")}`;
}

function parsePocket(
  lines: Line[],
  pocket: { id: string; name: string },
  pocketNames: Set<string>,
): ParsedStatementSection {
  const summary = (label: string) => {
    const title = lines.find(
      (line) => line.text === label && inColumn(line.x, SUMMARY_LABEL_X),
    );
    const value = lines.find(
      (line) =>
        title &&
        line.x > (title.x as number) + 50 &&
        Math.abs(line.position - title.position) < SAME_LINE &&
        AMOUNT.test(line.text),
    );
    if (!value) throw unreadable();
    return toCents(value.text);
  };
  const opening = summary("Saldo Sebelumnya");
  const closing = summary("Saldo Akhir");

  const starts = lines.filter(
    (line) => line.x < DATE_COLUMN_END && DATE.test(line.text),
  );
  const rows: ParsedStatementRow[] = [];
  let balance = opening;
  let income = 0;
  let expense = 0;
  starts.forEach((start, index) => {
    const next = starts[index + 1];
    const from = start.position - ROW_RISE;
    const to = next ? next.position - ROW_RISE : Number.POSITIVE_INFINITY;
    const block = lines.filter(
      (line) => line.position >= from && line.position < to,
    );
    const texts = (column: number[]) =>
      block.filter((line) => inColumn(line.x, column)).map((line) => line.text);

    const amount = block.find(
      (line) =>
        inColumn(line.x, AMOUNT_COLUMN) && SIGNED_AMOUNT.test(line.text),
    );
    const rowBalance = block.find(
      (line) => line.x >= BALANCE_COLUMN_START && AMOUNT.test(line.text),
    );
    const [, hour, minute] =
      block
        .find((line) => line.x < DATE_COLUMN_END && TIME.test(line.text))
        ?.text.match(TIME) ?? [];
    if (!amount || !rowBalance || !hour || !minute) throw unreadable();

    const cents = toCents(amount.text);
    balance += cents;
    if (cents === 0 || balance !== toCents(rowBalance.text)) throw unreadable();
    if (cents > 0) income += cents;
    else expense -= cents;

    const label = texts(DETAIL_COLUMN)[0] ?? "";
    const counterparty = texts(NAME_COLUMN)[0];
    const note = texts(NOTE_COLUMN).join(" ");
    const name = (counterparty || label).slice(0, MAX_ROW_NAME);
    if (!name) throw unreadable();
    rows.push({
      amount: Math.abs(cents) / 100,
      counterpart:
        POCKET_MOVE.test(label) &&
        counterparty &&
        pocketNames.has(counterparty) &&
        counterparty !== pocket.name
          ? counterparty
          : null,
      date: parseDate(start.text),
      detail: [label === name ? "" : label, note].filter(Boolean).join(" · "),
      name,
      time: `${hour}:${minute}:00`,
      type: cents > 0 ? "income" : "expense",
    });
  });

  if (
    balance !== closing ||
    income !== summary("Total Pemasukan") ||
    expense !== summary("Total Pengeluaran")
  ) {
    throw unreadable();
  }
  return {
    accountMask: pocket.id.slice(-4),
    closingBalance: closing / 100,
    key: pocket.id,
    name: pocket.name,
    openingBalance: opening / 100,
    rows,
  };
}
