export interface ParsedBankMessage {
  amount: number;
  counterpartyName: string;
  /** Digits of the other side's account, when the message shows them. */
  counterpartyNumber: null | string;
  /** YYYY-MM-DD in Jakarta time. */
  date: string;
  detail: string;
  /** Charged on top of the amount, recorded as its own expense. */
  fee: number;
  reference: null | string;
  /** Visible digits of the account the money left or entered. */
  sourceNumber: string;
  /** HH:mm:ss in Jakarta time. */
  time: string;
  type: "expense" | "income";
}

/** A message that is about a transaction but can't be trusted, or isn't one at all. */
export type ParseResult =
  | { message: ParsedBankMessage; status: "parsed" }
  | { reason: string; status: "failed" }
  | { status: "ignored" };

const MONTHS: Record<string, string> = {
  agt: "08",
  agu: "08",
  agustus: "08",
  apr: "04",
  april: "04",
  aug: "08",
  august: "08",
  dec: "12",
  december: "12",
  des: "12",
  desember: "12",
  feb: "02",
  februari: "02",
  february: "02",
  jan: "01",
  januari: "01",
  january: "01",
  jul: "07",
  juli: "07",
  july: "07",
  jun: "06",
  june: "06",
  juni: "06",
  mar: "03",
  march: "03",
  maret: "03",
  may: "05",
  mei: "05",
  nov: "11",
  november: "11",
  oct: "10",
  october: "10",
  okt: "10",
  oktober: "10",
  sep: "09",
  september: "09",
};

const failed = (reason: string): ParseResult => ({ reason, status: "failed" });

const after = (lines: string[], label: string) => {
  const index = lines.findIndex(
    (line) => line.toLowerCase() === label.toLowerCase(),
  );
  return index < 0 ? [] : lines.slice(index + 1);
};

const parseRupiah = (text?: string) => {
  const match = text?.match(/^Rp\s?([\d.]+)(?:,(\d{1,2}))?$/);
  if (!match) return null;
  return Number(`${(match[1] as string).replaceAll(".", "")}.${match[2] ?? 0}`);
};

const parseDate = (day?: string, month?: string, year?: string) => {
  const number = MONTHS[(month ?? "").toLowerCase()];
  return day && number && year
    ? `${year}-${number}-${day.padStart(2, "0")}`
    : null;
};

const digitsAfterDot = (line?: string) => {
  const part = line?.split("•").at(-1)?.trim();
  return part && /^\*{0,}\d+$/.test(part) ? part.replace(/\*/g, "") : null;
};

/** Reduces a message's HTML to its visible lines, so parsers read what a person reads. */
export function htmlToLines(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<(br|\/p|\/tr|\/div|\/td|\/h\d)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&bull;/g, "•")
    .replace(/&#\d+;/g, "")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseJagoEmail(lines: string[]): ParseResult {
  if (!lines.some((line) => /^Ringkasan transaksi$/i.test(line))) {
    return { status: "ignored" };
  }
  const isOutgoing = lines.some((line) =>
    /baru saja (melakukan transfer|mengirimkan uang)/i.test(line),
  );
  if (!isOutgoing) return failed("This Jago email type isn't supported yet");

  const from = after(lines, "Dari");
  const to = after(lines, "Ke");
  const sourceNumber = digitsAfterDot(from[0]);
  const counterpartyName = to[0];
  const amount = parseRupiah(after(lines, "Jumlah")[0]);
  const [, day, month, year, hour, minute] =
    after(lines, "Tanggal transaksi")[0]?.match(
      /^(\d{1,2}) (\p{L}+) (\d{4}),? (\d{2}):(\d{2}) WIB$/u,
    ) ?? [];
  const date = parseDate(day, month, year);
  if (!sourceNumber || !counterpartyName || !amount || !date) {
    return failed("This Jago email doesn't match the expected format");
  }
  const status = after(lines, "Status Transaksi")[0];
  if (status && status !== "Berhasil") {
    return failed("This transaction wasn't marked as successful");
  }
  return {
    message: {
      amount,
      counterpartyName,
      counterpartyNumber: digitsAfterDot(to[1]),
      date,
      detail: lines.some((line) => /Nama Acquirer/i.test(line))
        ? "Pembayaran QRIS"
        : "Transfer",
      fee: 0,
      reference: null,
      sourceNumber,
      time: `${hour}:${minute}:00`,
      type: "expense",
    },
    status: "parsed",
  };
}

export function parseWondrEmail(lines: string[]): ParseResult {
  if (!lines.some((line) => /bertransaksi dengan wondr/i.test(line))) {
    return { status: "ignored" };
  }
  if (!lines.includes("Transfer berhasil!")) {
    return failed("This wondr email type isn't supported yet");
  }
  const recipient = after(lines, "Penerima");
  const source = after(lines, "Sumber dana");
  const sourceNumber = digitsAfterDot(source[1]);
  const amount = parseRupiah(after(lines, "Nominal")[0]);
  const fee = parseRupiah(after(lines, "Biaya admin")[0]);
  const total = parseRupiah(after(lines, "Total")[0]);
  const reference = after(lines, "Reference ID")[0];
  const [, day, month, year] =
    after(lines, "Tanggal")[0]?.match(/^(\d{1,2})-(\p{L}+)-(\d{4})$/u) ?? [];
  const date = parseDate(day, month, year);
  const time = after(lines, "Waktu")[0]?.match(
    /^(\d{2}:\d{2}:\d{2}) WIB$/,
  )?.[1];
  const counterpartyName = recipient[0]?.replace(/\s*-$/, "");
  if (
    !sourceNumber ||
    !counterpartyName ||
    !amount ||
    fee === null ||
    total === null ||
    !date ||
    !time ||
    !reference
  ) {
    return failed("This wondr email doesn't match the expected format");
  }
  if (Math.round((amount + fee) * 100) !== Math.round(total * 100)) {
    return failed("The amounts in this wondr email don't add up");
  }
  return {
    message: {
      amount,
      counterpartyName,
      counterpartyNumber: digitsAfterDot(recipient[1]),
      date,
      detail: after(lines, "Metode")[0] ?? "Transfer",
      fee,
      reference: reference.slice(0, 64),
      sourceNumber,
      time,
      type: "expense",
    },
    status: "parsed",
  };
}
