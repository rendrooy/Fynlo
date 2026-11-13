import type { ParsedBankMessage, ParseResult } from "./email";

type Pattern = [RegExp, (match: RegExpMatchArray) => null | Reading];

/** What a notification says. The account and the time come from the Shortcut. */
type Reading = Pick<
  ParsedBankMessage,
  "amount" | "counterpartyName" | "detail" | "sourceName" | "type"
>;

export const NOTIFICATION_SOURCES = ["bni", "jago"] as const;
export type NotificationSource = (typeof NOTIFICATION_SOURCES)[number];

/** BNI's short notices don't say where the money went, so the statement fills it in later. */
export const UNNAMED_DETAIL = "wondr notification";

const AMOUNT = String.raw`Rp\.?\s?(\d[\d.]*(?:,\d{1,2})?)`;

const failed = (reason: string): ParseResult => ({ reason, status: "failed" });

const parseAmount = (text?: string) => {
  const [whole = "", cents = "0"] = (text ?? "").replace(/\.+$/, "").split(",");
  const value = Number(`${whole.replaceAll(".", "")}.${cents}`);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const reading = (
  type: Reading["type"],
  amountText: string | undefined,
  counterpartyName: string | undefined,
  detail: string,
  sourceName?: string,
): null | Reading => {
  const amount = parseAmount(amountText);
  const name = counterpartyName?.trim();
  return amount && name
    ? { amount, counterpartyName: name, detail, sourceName, type }
    : null;
};

const JAGO_IGNORED = [
  /dipindahkan dari Kantong/i,
  /^Kamu menarik /i,
  /^Pembayaran QR .* gagal$/i,
  /telah ditambah ke daftar kontak/i,
];

const JAGO: Pattern[] = [
  [
    new RegExp(
      `^Kamu telah membayar ${AMOUNT} dengan Transaksi GoPay Tabungan$`,
      "i",
    ),
    ([, amount]) =>
      reading(
        "expense",
        amount,
        "GoPay Tabungan",
        "Pembayaran",
        "GoPay Tabungan",
      ),
  ],
  [
    new RegExp(`^Kamu telah membayar ${AMOUNT} ke (.+)$`, "i"),
    ([, amount, merchant]) =>
      reading("expense", amount, merchant, "Pembayaran"),
  ],
  [
    new RegExp(
      `^Kamu telah melakukan transaksi sebesar ${AMOUNT} melalui (.+)$`,
      "i",
    ),
    ([, amount, wallet]) => reading("expense", amount, wallet, "Pembayaran"),
  ],
  [
    new RegExp(
      `^Kamu telah melakukan pembayaran sebesar ${AMOUNT} menggunakan kartu debit Jago$`,
      "i",
    ),
    ([, amount]) =>
      reading("expense", amount, "Kartu debit Jago", "Pembayaran kartu debit"),
  ],
  [
    new RegExp(`^Kamu telah melakukan transfer ${AMOUNT} ke (.+)$`, "i"),
    ([, amount, name]) => reading("expense", amount, name, "Transfer"),
  ],
  [
    new RegExp(`^(.+?) telah mengirim ${AMOUNT} ke kamu$`, "i"),
    ([, name, amount]) => reading("income", amount, name, "Transfer"),
  ],
];

const BNI: Pattern[] = [
  [
    new RegExp(`^Kamu baru aja transaksi sebesar ${AMOUNT}`, "i"),
    ([, amount]) => reading("expense", amount, "BNI", UNNAMED_DETAIL),
  ],
  [
    new RegExp(`^Kamu baru aja terima ${AMOUNT}`, "i"),
    ([, amount]) => reading("income", amount, "BNI", UNNAMED_DETAIL),
  ],
  [
    new RegExp(`^Pembayaran ${AMOUNT} pakai QRIS udah diterima (.+)$`, "i"),
    ([, amount, merchant]) =>
      reading("expense", amount, merchant, "Pembayaran QRIS"),
  ],
];

/**
 * Drops the title line and the bank's closing help line, leaving one sentence.
 * The Shortcut's Notification variable puts the title first, and the title never holds an amount.
 */
export function notificationSentence(text: string) {
  const lines = text
    .replace(/￼/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (lines.length > 1 && !/Rp/i.test(lines[0] as string)) lines.shift();
  return lines
    .join(" ")
    .replace(/\s*Butuh bantuan\?.*$/i, "")
    .replace(/\s*Jika bukan kamu,.*$/i, "")
    .replace(/\s*Klik untuk.*$/i, "")
    .trim()
    .replace(/\.$/, "");
}

export function parseNotification(
  source: NotificationSource,
  text: string,
  at: { accountNumber: string; date: string; time: string },
): ParseResult {
  const sentence = notificationSentence(text);
  // The credit card isn't tracked, and the BNI app also shows its notices.
  if (/\bAMEX\b|kartu kredit/i.test(sentence)) return { status: "ignored" };
  if (source === "jago" && JAGO_IGNORED.some((rule) => rule.test(sentence))) {
    return { status: "ignored" };
  }

  for (const [pattern, read] of source === "jago" ? JAGO : BNI) {
    const match = sentence.match(pattern);
    if (!match) continue;
    const result = read(match);
    if (!result) break;
    return {
      message: {
        ...result,
        counterpartyNumber: null,
        date: at.date,
        fee: 0,
        reference: null,
        sourceNumber: at.accountNumber,
        time: at.time,
      },
      status: "parsed",
    };
  }

  // Promotions mention amounts too, but never in the words a transaction uses.
  const looksLikeTransaction =
    source === "jago"
      ? /^Kamu telah |telah mengirim /i.test(sentence)
      : /^Kamu baru aja |^Pembayaran Rp/i.test(sentence);
  return looksLikeTransaction
    ? failed(
        `This ${source === "jago" ? "Jago" : "wondr"} notification isn't supported yet`,
      )
    : { status: "ignored" };
}
