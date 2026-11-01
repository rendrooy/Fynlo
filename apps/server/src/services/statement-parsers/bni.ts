import type { PdfTextItem } from "./pdf-text";
import type { ParsedStatement, ParsedStatementRow } from "./types";

import { HttpError } from "../../utils/http-error";

const MONTHS: Record<string, string> = {
  ags: "08",
  agt: "08",
  agu: "08",
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

// Column positions of BNI's "Laporan Mutasi Rekening" layout.
const DATE_COLUMN_END = 105;
const DETAIL_COLUMN = [105, 125];
const AMOUNT_COLUMN = [340, 480];
const BALANCE_COLUMN_START = 490;
const FOOTER_Y = 60;
const PAGE_OFFSET = 10000;
const SAME_LINE = 3;

const DATE = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/;
const TIME = /^(\d{2}:\d{2}:\d{2}) WIB$/;
const SIGNED_AMOUNT = /^[+-][\d,]+(\.\d{1,2})?$/;
const AMOUNT = /^-?[\d,]+(\.\d{1,2})?$/;

const unreadable = () =>
  new HttpError(
    422,
    "This statement doesn't match the BNI format Fynlo can read reliably",
  );

const toCents = (text: string) =>
  Math.round(Number(text.replace(/[+,]/g, "")) * 100);

const inColumn = (x: number, [start, end]: number[]) =>
  x >= (start as number) && x < (end as number);

export const isBniStatement = (items: PdfTextItem[]) =>
  items.some((item) => item.text === "Laporan Mutasi Rekening");

/** Parses a BNI statement and refuses it unless every balance adds up. */
export function parseBni(items: PdfTextItem[]): ParsedStatement {
  if (!isBniStatement(items)) {
    throw new HttpError(
      422,
      items.length === 0
        ? "This PDF has no readable text, so it may be a scan"
        : "This doesn't look like a BNI statement",
    );
  }

  // A running position lets a transaction continue across a page break.
  const lines = items
    .filter((item) => item.y > FOOTER_Y)
    .map((item) => ({ ...item, position: item.page * PAGE_OFFSET - item.y }))
    .sort((a, b) => a.position - b.position || a.x - b.x);

  const opening = findBalanceRow(lines, "Saldo Awal");
  const closing = findBalanceRow(lines, "Saldo Akhir");
  const starts = lines.filter(
    (line) =>
      line.position > opening.position &&
      line.position < closing.position &&
      line.x < DATE_COLUMN_END &&
      DATE.test(line.text),
  );

  const rows: ParsedStatementRow[] = [];
  let balance = opening.cents;
  starts.forEach((start, index) => {
    const end = starts[index + 1]?.position ?? closing.position;
    const block = lines.filter(
      (line) => line.position >= start.position && line.position < end,
    );
    const details = block.filter((line) => inColumn(line.x, DETAIL_COLUMN));
    const amount = block.find(
      (line) =>
        inColumn(line.x, AMOUNT_COLUMN) && SIGNED_AMOUNT.test(line.text),
    );
    const rowBalance = block.find(
      (line) => line.x >= BALANCE_COLUMN_START && AMOUNT.test(line.text),
    );
    const time = block
      .find((line) => line.x < DATE_COLUMN_END && TIME.test(line.text))
      ?.text.match(TIME)?.[1];
    const label = details[0]?.text;
    if (!amount || !rowBalance || !time || !label) throw unreadable();

    const cents = toCents(amount.text);
    balance += cents;
    if (cents === 0 || balance !== toCents(rowBalance.text)) throw unreadable();

    const description = details
      .slice(1)
      .map((line) => line.text)
      .join(" ")
      .replace(/^-\s*/, "")
      .trim();
    rows.push({
      amount: Math.abs(cents) / 100,
      counterpart: null,
      date: parseDate(start.text),
      detail: description ? label : "",
      name: description || label,
      time,
      type: cents > 0 ? "income" : "expense",
    });
  });

  if (balance !== closing.cents) throw unreadable();
  // Every amount on the statement has to belong to a row, so none can slip past the balances.
  const amounts = lines.filter(
    (line) =>
      line.position > opening.position &&
      line.position < closing.position &&
      inColumn(line.x, AMOUNT_COLUMN) &&
      SIGNED_AMOUNT.test(line.text),
  );
  if (amounts.length !== rows.length) throw unreadable();
  const printedTotals = readPrintedTotals(lines, rows);

  const account = lines
    .find((line) => /^[A-Z ]+ - \d{4,}$/.test(line.text))
    ?.text.match(/(\d{4})$/)?.[1];
  return {
    sections: [
      {
        accountMask: account ?? null,
        closingBalance: closing.cents / 100,
        // Statements of two BNI accounts must stay apart when read together.
        key: `bni-${account ?? "unknown"}`,
        name: "BNI",
        openingBalance: opening.cents / 100,
        printedTotals,
        rows,
      },
    ],
  };
}

function findBalanceRow(
  lines: (PdfTextItem & { position: number })[],
  label: string,
) {
  const title = lines.find(
    (line) => line.text === label && inColumn(line.x, DETAIL_COLUMN),
  );
  const value = lines.find(
    (line) =>
      title &&
      line.x >= BALANCE_COLUMN_START &&
      Math.abs(line.position - title.position) < SAME_LINE &&
      AMOUNT.test(line.text),
  );
  if (!title || !value) throw unreadable();
  return { cents: toCents(value.text), position: title.position };
}

function parseDate(text: string) {
  const [, day, month, year] = text.match(DATE) ?? [];
  const monthNumber = MONTHS[(month ?? "").toLowerCase()];
  if (!day || !monthNumber || !year) throw unreadable();
  return `${year}-${monthNumber}-${day.padStart(2, "0")}`;
}

/**
 * BNI's printed totals sometimes disagree with the rows it lists: December 2025 doesn't lead
 * from opening to closing, and March 2026 counts money in and out that no row shows. The running
 * balances are the proof, so a disagreement is reported rather than refused.
 */
function readPrintedTotals(
  lines: (PdfTextItem & { position: number })[],
  rows: ParsedStatementRow[],
) {
  const printed = (label: string) => {
    const title = lines.find((line) => line.text === label);
    const value = lines.find(
      (line) =>
        title &&
        SIGNED_AMOUNT.test(line.text) &&
        line.position > title.position &&
        line.position < title.position + 30 &&
        Math.abs(line.x - title.x) < 30,
    );
    if (!value) throw unreadable();
    return Math.abs(toCents(value.text));
  };
  const total = (type: ParsedStatementRow["type"]) =>
    rows
      .filter((row) => row.type === type)
      .reduce((sum, row) => sum + Math.round(row.amount * 100), 0);
  const income = printed("Total Pemasukan");
  const expense = printed("Total Pengeluaran");
  return income === total("income") && expense === total("expense")
    ? null
    : { expense: expense / 100, income: income / 100 };
}
