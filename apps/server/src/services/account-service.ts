import { pool } from "../connection/db";
import { HttpError } from "../utils/http-error";
import { isUuid } from "../utils/validation";

interface AccountRow {
  account_type_id: string;
  color: string;
  id: string;
  is_excluded: boolean;
  mask: null | string;
  name: string;
  opening_balance: string;
  source: string;
  type_name: string;
}

const SOURCES = ["email", "manual", "shortcut"];
const MAX_BALANCE = 1e15;
const SELECT_ACCOUNT = `
  SELECT a.id, a.name, a.account_type_id, t.name AS type_name, a.mask, a.color,
         a.source, a.opening_balance, a.is_excluded
  FROM m_account a
  JOIN m_account_type t ON t.id = a.account_type_id`;

const toAccount = (row: AccountRow) => ({
  accountTypeId: row.account_type_id,
  color: row.color,
  id: row.id,
  isExcluded: row.is_excluded,
  mask: row.mask,
  name: row.name,
  openingBalance: Number(row.opening_balance),
  source: row.source,
  typeName: row.type_name,
});

const invalid = (message: string) => new HttpError(400, message);
const notFound = () => new HttpError(404, "Account not found");

export async function createAccount(
  userId: string,
  input: Record<string, unknown>,
) {
  const source = input.source ?? "manual";
  if (typeof source !== "string" || !SOURCES.includes(source)) {
    throw invalid("Source must be email, manual, or shortcut");
  }
  const name = parseName(input.name);
  const mask = parseMask(input.mask);
  const color = parseColor(input.color);
  const balance = parseBalance(input.openingBalance ?? 0);
  const typeId = await parseAccountType(userId, input.accountTypeId);
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO m_account
       (user_id, name, account_type_id, mask, color, source, opening_balance)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [userId, name, typeId, mask, color, source, balance],
  );
  return getAccount(userId, (rows[0] as { id: string }).id);
}

export async function deleteAccount(userId: string, accountId: string) {
  if (!isUuid(accountId)) throw notFound();
  const { rowCount } = await pool.query(
    `UPDATE m_account SET is_deleted = true, updated_time = now()
     WHERE user_id = $1 AND id = $2 AND NOT is_deleted`,
    [userId, accountId],
  );
  if (!rowCount) throw notFound();
}

export async function listAccounts(userId: string) {
  const { rows } = await pool.query<AccountRow>(
    `${SELECT_ACCOUNT}
     WHERE a.user_id = $1 AND NOT a.is_deleted
     ORDER BY a.created_time`,
    [userId],
  );
  return rows.map(toAccount);
}

export async function updateAccount(
  userId: string,
  accountId: string,
  input: Record<string, unknown>,
) {
  // Column names come only from this list, never from the request.
  const parsers: Record<string, [string, (value: unknown) => unknown]> = {
    accountTypeId: [
      "account_type_id",
      (value) => parseAccountType(userId, value),
    ],
    color: ["color", parseColor],
    isExcluded: [
      "is_excluded",
      (value) => {
        if (typeof value !== "boolean") throw invalid("Invalid excluded flag");
        return value;
      },
    ],
    mask: ["mask", parseMask],
    name: ["name", parseName],
    openingBalance: ["opening_balance", parseBalance],
  };

  const values: unknown[] = [userId, accountId];
  const assignments: string[] = [];
  for (const [field, [column, parse]] of Object.entries(parsers)) {
    if (input[field] === undefined) continue;
    values.push(await parse(input[field]));
    assignments.push(`${column} = $${values.length}`);
  }
  if (assignments.length === 0) throw invalid("No changes to save");
  if (!isUuid(accountId)) throw notFound();

  const { rowCount } = await pool.query(
    `UPDATE m_account SET ${assignments.join(", ")}, updated_time = now()
     WHERE user_id = $1 AND id = $2 AND NOT is_deleted`,
    values,
  );
  if (!rowCount) throw notFound();
  return getAccount(userId, accountId);
}

async function getAccount(userId: string, accountId: string) {
  const { rows } = await pool.query<AccountRow>(
    `${SELECT_ACCOUNT}
     WHERE a.user_id = $1 AND a.id = $2 AND NOT a.is_deleted`,
    [userId, accountId],
  );
  if (!rows[0]) throw notFound();
  return toAccount(rows[0]);
}

/** A type must belong to the same user, or accounts could reach other users' data. */
async function parseAccountType(userId: string, value: unknown) {
  if (isUuid(value)) {
    const { rowCount } = await pool.query(
      "SELECT 1 FROM m_account_type WHERE user_id = $1 AND id = $2 AND NOT is_deleted",
      [userId, value],
    );
    if (rowCount) return value;
  }
  throw invalid("Choose a valid account type");
}

function parseBalance(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) >= MAX_BALANCE
  ) {
    throw invalid("Opening balance must be a valid amount");
  }
  return value;
}

function parseColor(value: unknown) {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw invalid("Color must be a hex color such as #0f766e");
  }
  return value;
}

function parseMask(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}$/.test(value)) {
    throw invalid("Mask must be the last 4 digits");
  }
  return value;
}

function parseName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 100) {
    throw invalid("Name must have 1 to 100 characters");
  }
  return name;
}
