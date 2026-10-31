import type {
  ParsedStatementRow,
  ParsedStatementSection,
} from "./statement-parsers/types";

import { pool } from "../connection/db";
import { HttpError } from "../utils/http-error";
import { isUuid } from "../utils/validation";
import { loadCategoryGuesser } from "./category-guess";
import { isBniStatement, parseBni } from "./statement-parsers/bni";
import { isJagoStatement, parseJago } from "./statement-parsers/jago";
import { readPdfText } from "./statement-parsers/pdf-text";
import {
  parseAmount,
  parseDetail,
  parseName,
  parseOccurredAt,
  TIME_ZONE,
} from "./transaction-service";

// Adding a bank means adding one parser here.
const BANKS = [
  { detect: isBniStatement, name: "BNI", parse: parseBni },
  { detect: isJagoStatement, name: "Jago", parse: parseJago },
];

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

interface ExistingTransaction {
  amount: string;
  at: string;
  day: string;
  is_transfer: boolean;
  source: string;
  type: string;
}

export function guessCategory(
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

export async function importStatement(
  userId: string,
  input: Record<string, unknown>,
) {
  if (!Array.isArray(input.sections) || input.sections.length === 0) {
    throw invalid("Choose at least one transaction to import");
  }
  const sections = await Promise.all(
    input.sections.map(async (section: Record<string, unknown>) => {
      const opening = section.openingBalance ?? null;
      if (
        opening !== null &&
        (typeof opening !== "number" || !Number.isFinite(opening))
      ) {
        throw invalid("Opening balance must be a valid amount");
      }
      if (!Array.isArray(section.rows)) {
        throw invalid("Choose at least one transaction to import");
      }
      return {
        accountId: await parseOwnedAccount(userId, section.accountId),
        opening: opening as null | number,
        rows: section.rows.map(parseImportRow),
      };
    }),
  );
  const accountIds = sections.map((section) => section.accountId);
  if (new Set(accountIds).size !== accountIds.length) {
    throw invalid("Choose a different account for each one");
  }
  const rows = sections.flatMap((section) =>
    section.rows.map((row) => ({ ...row, accountId: section.accountId })),
  );
  if (rows.length === 0) {
    throw invalid("Choose at least one transaction to import");
  }
  if (rows.length > MAX_ROWS) {
    throw invalid(`A statement can have at most ${MAX_ROWS} transactions`);
  }

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
    if (row.transferAccountId === row.accountId) {
      throw invalid("Choose a different account for the transfer");
    }
  }

  const targets = [...new Set(rows.flatMap((r) => r.transferAccountId ?? []))];
  if (!targets.every(isUuid)) {
    throw invalid("Choose a different account for the transfer");
  }
  const { rowCount: ownedTargets } = await pool.query(
    `SELECT 1 FROM m_account
     WHERE user_id = $1 AND id = ANY($2::uuid[]) AND NOT is_deleted`,
    [userId, targets],
  );
  if (ownedTargets !== targets.length) {
    throw invalid("Choose a different account for the transfer");
  }

  // All or nothing, so a failed import never leaves half a statement behind.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO t_transaction
         (user_id, account_id, to_account_id, category_id, type, amount, name,
          detail, occurred_at, source, status)
       SELECT $1,
              -- Money coming in was sent from the other account, and vice versa.
              CASE WHEN r.target IS NOT NULL AND r.type = 'income' THEN r.target ELSE r.account END,
              CASE WHEN r.target IS NULL THEN NULL
                   WHEN r.type = 'income' THEN r.account ELSE r.target END,
              r.category_id,
              CASE WHEN r.target IS NULL THEN r.type ELSE 'transfer' END,
              r.amount, r.name, r.detail,
              r.occurred_at::timestamp AT TIME ZONE '${TIME_ZONE}', 'import',
              CASE WHEN r.category_id IS NULL AND r.target IS NULL THEN 'review' ELSE 'verified' END
       FROM unnest($2::uuid[], $3::uuid[], $4::text[], $5::numeric[], $6::text[], $7::text[], $8::text[], $9::uuid[])
         AS r (account, category_id, type, amount, name, detail, occurred_at, target)`,
      [
        userId,
        rows.map((r) => r.accountId),
        rows.map((r) => r.categoryId),
        rows.map((r) => r.type),
        rows.map((r) => r.amount),
        rows.map((r) => r.name),
        rows.map((r) => r.detail),
        rows.map((r) => r.occurredAt),
        rows.map((r) => r.transferAccountId),
      ],
    );
    for (const section of sections) {
      if (section.opening === null) continue;
      await client.query(
        `UPDATE m_account SET opening_balance = $3, updated_time = now()
         WHERE user_id = $1 AND id = $2`,
        [userId, section.accountId, section.opening],
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
  const chosenAccounts = await parseAccountMap(userId, input.accounts);
  const password =
    typeof input.password === "string" && input.password
      ? input.password
      : undefined;
  const items = await readPdfText(file, password);
  const bank = BANKS.find(({ detect }) => detect(items));
  if (!bank) {
    throw new HttpError(
      422,
      items.length === 0
        ? "This PDF has no readable text, so it may be a scan"
        : "Fynlo can't read statements from this bank yet",
    );
  }
  const statement = bank.parse(items);

  const [{ rows: accounts }, { rows: owner }, { rows: categories }] =
    await Promise.all([
      pool.query<{ id: string; mask: null | string; name: string }>(
        "SELECT id, mask, name FROM m_account WHERE user_id = $1 AND NOT is_deleted ORDER BY created_time",
        [userId],
      ),
      pool.query<{ name: string }>("SELECT name FROM m_user WHERE id = $1", [
        userId,
      ]),
      pool.query<{ id: string; name: string; type: string }>(
        "SELECT id, name, type FROM m_category WHERE user_id = $1 AND NOT is_deleted",
        [userId],
      ),
    ]);
  const ownName = owner[0]?.name.toLowerCase() ?? "";
  const guessFromHistory = await loadCategoryGuesser(pool, userId);

  const accountOfPocket = new Map(
    statement.sections.flatMap((section) => {
      const accountId = chosenAccounts[section.key];
      return accountId ? [[section.name, accountId] as const] : [];
    }),
  );
  const mirrors = findMirrors(statement.sections, accountOfPocket);
  const taken = new Set(Object.values(chosenAccounts));

  const sections = await Promise.all(
    statement.sections.map(async (section) => {
      const accountId = chosenAccounts[section.key] ?? null;
      const account = accounts.find((a) => a.id === accountId);
      // Banks list by posting order, which can differ slightly from the transaction time.
      const dates = section.rows.map((row) => row.date).sort();
      const firstDate = dates[0] ?? "1970-01-01";
      const lastDate = dates.at(-1) ?? "1970-01-01";
      const { earlier, existing } = accountId
        ? await loadAccountHistory(userId, accountId, firstDate, lastDate)
        : { earlier: false, existing: [] };

      // Each saved transaction can cover only one row, so real look-alikes stay selected.
      const unmatched = [...existing];
      const takeMatch = (matches: (item: ExistingTransaction) => boolean) => {
        const index = unmatched.findIndex(matches);
        if (index < 0) return false;
        unmatched.splice(index, 1);
        return true;
      };

      const suggestion = accounts.find(
        (a) =>
          !taken.has(a.id) &&
          ((section.accountMask && a.mask === section.accountMask) ||
            a.name.toLowerCase() === section.name.toLowerCase()),
      );
      if (!accountId && suggestion) taken.add(suggestion.id);

      return {
        accountId,
        accountMask: section.accountMask,
        bank: bank.name,
        canSetOpeningBalance: !earlier,
        closingBalance: section.closingBalance,
        isDifferentAccount: Boolean(
          account?.mask &&
          section.accountMask &&
          account.mask !== section.accountMask,
        ),
        key: section.key,
        name: section.name,
        openingBalance: section.openingBalance,
        rows: section.rows.map((row) => {
          const same = (item: ExistingTransaction) =>
            Number(item.amount) === row.amount && item.type === row.type;
          const isDuplicate =
            takeMatch(
              (item) => same(item) && item.at === `${row.date} ${row.time}`,
            ) ||
            // Manual entries and the other side of a transfer have a different
            // time or none, so the day has to be enough.
            takeMatch(
              (item) =>
                same(item) &&
                (item.source !== "import" || item.is_transfer) &&
                item.day === row.date,
            );
          const transferAccountId =
            (row.counterpart && accountOfPocket.get(row.counterpart)) || null;
          const { counterpart, ...fields } = row;
          const isPossibleTransfer =
            (Boolean(counterpart) && !transferAccountId) ||
            (ownName !== "" && row.name.toLowerCase().includes(ownName));
          // A possible transfer is the user's call, so no category is filled in for it.
          const categoryId =
            counterpart || isPossibleTransfer
              ? null
              : (guessFromHistory(row) ?? guessCategory(categories, row));
          return {
            ...fields,
            categoryId,
            isDuplicate,
            isMirror: mirrors.has(row),
            isPossibleTransfer,
            isSuggested: categoryId !== null,
            transferAccountId,
          };
        }),
        suggestedAccountId: accountId ?? suggestion?.id ?? null,
      };
    }),
  );
  return { sections };
}

/** A move between two chosen pockets appears in both. The incoming side is the one to hide. */
function findMirrors(
  sections: ParsedStatementSection[],
  accountOfPocket: Map<string, string>,
) {
  const mirrors = new Set<ParsedStatementRow>();
  const used = new Set<ParsedStatementRow>();
  for (const section of sections) {
    if (!accountOfPocket.has(section.name)) continue;
    for (const row of section.rows) {
      if (row.type !== "income" || !row.counterpart) continue;
      if (!accountOfPocket.has(row.counterpart)) continue;
      const source = sections
        .find((other) => other.name === row.counterpart)
        ?.rows.find(
          (other) =>
            !used.has(other) &&
            other.type === "expense" &&
            other.counterpart === section.name &&
            other.amount === row.amount &&
            other.date === row.date &&
            other.time === row.time,
        );
      if (!source) continue;
      used.add(source);
      mirrors.add(row);
    }
  }
  return mirrors;
}

async function loadAccountHistory(
  userId: string,
  accountId: string,
  firstDate: string,
  lastDate: string,
) {
  const { rows: existing } = await pool.query<ExistingTransaction>(
    // A transfer counts as money out of its source and into its destination.
    `SELECT amount, source, type = 'transfer' AS is_transfer,
            CASE WHEN type <> 'transfer' THEN type
                 WHEN account_id = $2 THEN 'expense' ELSE 'income' END AS type,
            to_char(occurred_at AT TIME ZONE '${TIME_ZONE}', 'YYYY-MM-DD HH24:MI:SS') AS at,
            to_char(occurred_at AT TIME ZONE '${TIME_ZONE}', 'YYYY-MM-DD') AS day
     FROM t_transaction
     WHERE user_id = $1 AND (account_id = $2 OR to_account_id = $2) AND NOT is_deleted
       AND (occurred_at AT TIME ZONE '${TIME_ZONE}')::date BETWEEN $3::date AND $4::date`,
    [userId, accountId, firstDate, lastDate],
  );
  const { rowCount } = await pool.query(
    `SELECT 1 FROM t_transaction
     WHERE user_id = $1 AND (account_id = $2 OR to_account_id = $2) AND NOT is_deleted
       AND (occurred_at AT TIME ZONE '${TIME_ZONE}')::date < $3::date
     LIMIT 1`,
    [userId, accountId, firstDate],
  );
  return { earlier: Boolean(rowCount), existing };
}

/** Sent as text because the statement arrives as a file upload. */
async function parseAccountMap(userId: string, value: unknown) {
  if (value === undefined || value === "") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(value));
  } catch {
    throw invalid("Choose a valid account");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw invalid("Choose a valid account");
  }
  const map: Record<string, string> = {};
  for (const [key, accountId] of Object.entries(parsed)) {
    map[key] = await parseOwnedAccount(userId, accountId);
  }
  const ids = Object.values(map);
  if (new Set(ids).size !== ids.length) {
    throw invalid("Choose a different account for each pocket");
  }
  return map;
}

function parseImportRow(row: Record<string, unknown>) {
  if (typeof row.type !== "string" || !TYPES.includes(row.type)) {
    throw invalid("Type must be expense or income");
  }
  if (row.transferAccountId && row.categoryId) {
    throw invalid("A transfer can't have a category");
  }
  return {
    amount: parseAmount(row.amount),
    categoryId: row.categoryId ? String(row.categoryId) : null,
    detail: parseDetail(row.detail),
    name: parseName(row.name),
    occurredAt: parseOccurredAt(row.date, row.time),
    transferAccountId: row.transferAccountId
      ? String(row.transferAccountId)
      : null,
    type: row.type,
  };
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
