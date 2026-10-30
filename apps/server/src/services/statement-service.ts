import { pool } from "../connection/db";
import { HttpError } from "../utils/http-error";
import { isUuid } from "../utils/validation";
import { parseBni } from "./statement-parsers/bni";
import { readPdfText } from "./statement-parsers/pdf-text";
import {
  parseAmount,
  parseDetail,
  parseName,
  parseOccurredAt,
  TIME_ZONE,
} from "./transaction-service";

// Adding a bank means adding one parser here.
const PARSERS = { bni: parseBni };

const MAX_ROWS = 5000;
const TYPES = ["expense", "income"];

// Matched against the user's own categories by name, so renamed ones are simply skipped.
const KEYWORDS: { category: string; words: string[] }[] = [
  { category: "Bills", words: ["pln", "listrik", "pulsa", "pdam", "bpjs"] },
  {
    category: "Food & Drinks",
    words: ["kantin", "resto", "warung", "kopi", "coffee", "bakso", "gofood"],
  },
  {
    category: "Shopping",
    words: ["tokopedia", "shopee", "indomaret", "alfamart", "lazada"],
  },
  {
    category: "Transport",
    words: ["gojek", "grab", "tapcash", "mrt", "krl", "pertamina", "parkir"],
  },
];

const invalid = (message: string) => new HttpError(400, message);

export async function importStatement(
  userId: string,
  input: Record<string, unknown>,
) {
  const accountId = await parseOwnedAccount(userId, input.accountId);
  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    throw invalid("Choose at least one transaction to import");
  }
  if (input.rows.length > MAX_ROWS) {
    throw invalid(`A statement can have at most ${MAX_ROWS} transactions`);
  }
  const rows = input.rows.map((row: Record<string, unknown>) => {
    if (typeof row.type !== "string" || !TYPES.includes(row.type)) {
      throw invalid("Type must be expense or income");
    }
    return {
      amount: parseAmount(row.amount),
      categoryId: row.categoryId ? String(row.categoryId) : null,
      detail: parseDetail(row.detail),
      name: parseName(row.name),
      occurredAt: parseOccurredAt(row.date, row.time),
      type: row.type,
    };
  });

  // A category must belong to this user and match the row's direction.
  const chosen = [...new Set(rows.flatMap((r) => r.categoryId ?? []))];
  if (!chosen.every(isUuid)) throw invalid("Choose a valid category");
  const { rows: categories } = await pool.query<{ id: string; type: string }>(
    `SELECT id, type FROM m_category
     WHERE user_id = $1 AND id = ANY($2::uuid[]) AND NOT is_deleted`,
    [userId, chosen],
  );
  const typeOf = new Map(categories.map((c) => [c.id, c.type]));
  for (const row of rows) {
    if (row.categoryId && typeOf.get(row.categoryId) !== row.type) {
      throw invalid("Choose a valid category");
    }
  }

  const opening = input.openingBalance ?? null;
  if (
    opening !== null &&
    (typeof opening !== "number" || !Number.isFinite(opening))
  ) {
    throw invalid("Opening balance must be a valid amount");
  }

  // All or nothing, so a failed import never leaves half a statement behind.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO t_transaction
         (user_id, account_id, category_id, type, amount, name, detail,
          occurred_at, source, status)
       SELECT $1, $2, r.category_id, r.type, r.amount, r.name, r.detail,
              r.occurred_at::timestamp AT TIME ZONE '${TIME_ZONE}', 'import',
              CASE WHEN r.category_id IS NULL THEN 'review' ELSE 'verified' END
       FROM unnest($3::uuid[], $4::text[], $5::numeric[], $6::text[], $7::text[], $8::text[])
         AS r (category_id, type, amount, name, detail, occurred_at)`,
      [
        userId,
        accountId,
        rows.map((r) => r.categoryId),
        rows.map((r) => r.type),
        rows.map((r) => r.amount),
        rows.map((r) => r.name),
        rows.map((r) => r.detail),
        rows.map((r) => r.occurredAt),
      ],
    );
    if (opening !== null) {
      await client.query(
        `UPDATE m_account SET opening_balance = $3, updated_time = now()
         WHERE user_id = $1 AND id = $2`,
        [userId, accountId, opening],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return { imported: rows.length };
}

export async function previewStatement(
  userId: string,
  input: Record<string, unknown>,
  file?: Buffer,
) {
  if (!file) throw invalid("Choose a PDF file");
  const accountId = await parseOwnedAccount(userId, input.accountId);
  const parse = PARSERS[input.bank as keyof typeof PARSERS];
  if (!parse || !Object.hasOwn(PARSERS, input.bank as string)) {
    throw invalid("Choose a supported bank");
  }
  const password =
    typeof input.password === "string" && input.password
      ? input.password
      : undefined;
  const statement = parse(await readPdfText(file, password));

  const { rows: accounts } = await pool.query<{ mask: null | string }>(
    "SELECT mask FROM m_account WHERE user_id = $1 AND id = $2",
    [userId, accountId],
  );
  const mask = accounts[0]?.mask;
  // Banks list by posting order, which can differ slightly from the transaction time.
  const dates = statement.rows.map((row) => row.date).sort();
  const firstDate = dates[0];
  const lastDate = dates.at(-1);

  const { rows: existing } = await pool.query<{
    amount: string;
    at: string;
    day: string;
    source: string;
    type: string;
  }>(
    `SELECT amount, type, source,
            to_char(occurred_at AT TIME ZONE '${TIME_ZONE}', 'YYYY-MM-DD HH24:MI:SS') AS at,
            to_char(occurred_at AT TIME ZONE '${TIME_ZONE}', 'YYYY-MM-DD') AS day
     FROM t_transaction
     WHERE user_id = $1 AND account_id = $2 AND NOT is_deleted
       AND (occurred_at AT TIME ZONE '${TIME_ZONE}')::date BETWEEN $3::date AND $4::date`,
    [userId, accountId, firstDate ?? "1970-01-01", lastDate ?? "1970-01-01"],
  );
  const { rowCount: earlier } = await pool.query(
    `SELECT 1 FROM t_transaction
     WHERE user_id = $1 AND account_id = $2 AND NOT is_deleted
       AND (occurred_at AT TIME ZONE '${TIME_ZONE}')::date < $3::date
     LIMIT 1`,
    [userId, accountId, firstDate ?? "1970-01-01"],
  );

  const { rows: categories } = await pool.query<{
    id: string;
    name: string;
    type: string;
  }>(
    "SELECT id, name, type FROM m_category WHERE user_id = $1 AND NOT is_deleted",
    [userId],
  );

  // Each saved transaction can cover only one row, so real look-alikes stay selected.
  const unmatched = [...existing];
  const takeMatch = (matches: (item: (typeof existing)[number]) => boolean) => {
    const index = unmatched.findIndex(matches);
    if (index < 0) return false;
    unmatched.splice(index, 1);
    return true;
  };

  return {
    accountMask: statement.accountMask,
    canSetOpeningBalance: !earlier,
    closingBalance: statement.closingBalance,
    isDifferentAccount: Boolean(
      mask && statement.accountMask && mask !== statement.accountMask,
    ),
    openingBalance: statement.openingBalance,
    rows: statement.rows.map((row) => {
      const same = (item: (typeof existing)[number]) =>
        Number(item.amount) === row.amount && item.type === row.type;
      const isDuplicate =
        takeMatch(
          (item) => same(item) && item.at === `${row.date} ${row.time}`,
        ) ||
        // Manual entries have no exact time, so the day has to be enough.
        takeMatch(
          (item) =>
            same(item) && item.source !== "import" && item.day === row.date,
        );
      return {
        ...row,
        categoryId: guessCategory(categories, row),
        isDuplicate,
      };
    }),
  };
}

function guessCategory(
  categories: { id: string; name: string; type: string }[],
  row: { detail: string; name: string; type: string },
) {
  if (row.type !== "expense") return null;
  const text = `${row.name} ${row.detail}`.toLowerCase();
  const rule = KEYWORDS.find(({ words }) =>
    words.some((word) => new RegExp(`\\b${word}\\b`).test(text)),
  );
  return (
    categories.find((c) => c.type === row.type && c.name === rule?.category)
      ?.id ?? null
  );
}

async function parseOwnedAccount(userId: string, value: unknown) {
  if (isUuid(value)) {
    const { rowCount } = await pool.query(
      "SELECT 1 FROM m_account WHERE user_id = $1 AND id = $2 AND NOT is_deleted",
      [userId, value],
    );
    if (rowCount) return value;
  }
  throw invalid("Choose a valid account");
}
