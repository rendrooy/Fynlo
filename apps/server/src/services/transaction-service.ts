import { pool } from "../connection/db";
import { HttpError } from "../utils/http-error";
import { isUuid } from "../utils/validation";

interface TransactionRow {
  account_id: string;
  amount: string;
  category_id: null | string;
  date: string;
  detail: null | string;
  id: string;
  is_not_duplicate: boolean;
  name: string;
  source: string;
  status: string;
  time: string;
  to_account_id: null | string;
  type: string;
}

// Fynlo works in one region, so a date and time always mean Jakarta time.
export const TIME_ZONE = "Asia/Jakarta";
const MAX_AMOUNT = 1e15;
const MAX_DUPLICATE_GROUP = 100;
const STATUSES = ["review", "verified"];
const SELECT_TRANSACTION = `
  SELECT t.id, t.account_id, t.category_id, t.type, t.amount, t.name, t.detail,
         to_char(t.occurred_at AT TIME ZONE '${TIME_ZONE}', 'YYYY-MM-DD') AS date,
         to_char(t.occurred_at AT TIME ZONE '${TIME_ZONE}', 'HH24:MI') AS time,
         t.source, t.status, t.to_account_id, t.is_not_duplicate
  FROM t_transaction t`;
const OCCURRED_AT = (parameter: string) =>
  `(${parameter}::timestamp AT TIME ZONE '${TIME_ZONE}')`;

const toTransaction = (row: TransactionRow) => ({
  accountId: row.account_id,
  amount: Number(row.amount),
  categoryId: row.category_id,
  date: row.date,
  detail: row.detail ?? "",
  id: row.id,
  isNotDuplicate: row.is_not_duplicate,
  name: row.name,
  source: row.source,
  status: row.status,
  time: row.time,
  toAccountId: row.to_account_id,
  type: row.type,
});

const invalid = (message: string) => new HttpError(400, message);
const notFound = () => new HttpError(404, "Transaction not found");

export async function createTransaction(
  userId: string,
  input: Record<string, unknown>,
) {
  const amount = parseAmount(input.amount);
  const name = parseName(input.name);
  const detail = parseDetail(input.detail);
  const occurredAt = parseOccurredAt(input.date, input.time);
  const accountId = await parseAccount(userId, input.accountId);
  // A transfer has a destination instead of a category.
  const toAccountId = input.toAccountId
    ? await parseTransferTarget(userId, input.toAccountId, accountId)
    : null;
  if (toAccountId && input.categoryId) {
    throw invalid("A transfer can't have a category");
  }
  const category = toAccountId
    ? null
    : await parseCategory(userId, input.categoryId);
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO t_transaction
       (user_id, account_id, to_account_id, category_id, type, amount, name, detail, occurred_at, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${OCCURRED_AT("$9")}, 'manual')
     RETURNING id`,
    [
      userId,
      accountId,
      toAccountId,
      category?.id ?? null,
      category?.type ?? "transfer",
      amount,
      name,
      detail,
      occurredAt,
    ],
  );
  return getTransaction(userId, (rows[0] as { id: string }).id);
}

export async function deleteTransaction(userId: string, transactionId: string) {
  if (!isUuid(transactionId)) throw notFound();
  const { rowCount } = await pool.query(
    `UPDATE t_transaction SET is_deleted = true, updated_time = now()
     WHERE user_id = $1 AND id = $2 AND NOT is_deleted`,
    [userId, transactionId],
  );
  if (!rowCount) throw notFound();
}

export async function listTransactions(userId: string) {
  const { rows } = await pool.query<TransactionRow>(
    `${SELECT_TRANSACTION}
     WHERE t.user_id = $1 AND NOT t.is_deleted
     ORDER BY t.occurred_at DESC, t.created_time DESC`,
    [userId],
  );
  return rows.map(toTransaction);
}

/** One request, so every copy in a group of look-alikes changes together. */
export async function markNotDuplicate(
  userId: string,
  input: Record<string, unknown>,
) {
  const { ids } = input;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > MAX_DUPLICATE_GROUP ||
    !ids.every(isUuid)
  ) {
    throw invalid("Choose the transactions to mark");
  }
  const { rowCount } = await pool.query(
    `UPDATE t_transaction SET is_not_duplicate = true, updated_time = now()
     WHERE user_id = $1 AND id = ANY($2::uuid[]) AND NOT is_deleted`,
    [userId, ids],
  );
  if (rowCount !== new Set(ids).size) throw notFound();
  return { updated: rowCount };
}

export function parseAmount(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value >= MAX_AMOUNT ||
    Math.round(value * 100) / 100 !== value
  ) {
    throw invalid("Amount must be greater than 0 with at most 2 decimals");
  }
  return value;
}

export function parseDetail(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 255) {
    throw invalid("Note must have at most 255 characters");
  }
  return value.trim() || null;
}

export function parseName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 100) {
    throw invalid("Name must have 1 to 100 characters");
  }
  return name;
}

export function parseOccurredAt(date: unknown, time: unknown) {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    // A rolled-over date such as February 31 comes back different.
    Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  ) {
    throw invalid("Date must be a valid YYYY-MM-DD date");
  }
  if (
    typeof time !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time)
  ) {
    throw invalid("Time must be a valid HH:mm time");
  }
  return `${date} ${time}`;
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  input: Record<string, unknown>,
) {
  if (!isUuid(transactionId)) throw notFound();

  const values: unknown[] = [userId, transactionId];
  const assignments: string[] = [];
  // Column names come only from this function, never from the request.
  const assign = (
    column: string,
    value: unknown,
    placeholder = (p: string) => p,
  ) => {
    values.push(value);
    assignments.push(`${column} = ${placeholder(`$${values.length}`)}`);
  };

  const { rows: current } = await pool.query<{
    account_id: string;
    to_account_id: null | string;
  }>(
    `SELECT account_id, to_account_id FROM t_transaction
     WHERE user_id = $1 AND id = $2 AND NOT is_deleted`,
    [userId, transactionId],
  );
  if (!current[0]) throw notFound();
  if (input.toAccountId && input.categoryId) {
    throw invalid("A transfer can't have a category");
  }
  if (input.toAccountId === null && !input.categoryId) {
    throw invalid("Choose a valid category");
  }

  const accountId =
    input.accountId === undefined
      ? current[0].account_id
      : await parseAccount(userId, input.accountId);
  if (input.accountId !== undefined) assign("account_id", accountId);
  if (input.amount !== undefined) assign("amount", parseAmount(input.amount));
  if (input.categoryId !== undefined) {
    // The type always follows the category, so the two can never disagree.
    const category = await parseCategory(userId, input.categoryId);
    assign("category_id", category.id);
    assign("type", category.type);
    assign("to_account_id", null);
  } else if (input.toAccountId) {
    assign(
      "to_account_id",
      await parseTransferTarget(userId, input.toAccountId, accountId),
    );
    assign("category_id", null);
    assign("type", "transfer");
  } else if (accountId === current[0].to_account_id) {
    throw invalid("Choose two different accounts");
  }
  if (input.date !== undefined || input.time !== undefined) {
    assign("occurred_at", parseOccurredAt(input.date, input.time), OCCURRED_AT);
  }
  if (input.detail !== undefined) assign("detail", parseDetail(input.detail));
  if (input.name !== undefined) assign("name", parseName(input.name));
  if (input.isNotDuplicate !== undefined) {
    if (typeof input.isNotDuplicate !== "boolean") {
      throw invalid("Invalid duplicate flag");
    }
    assign("is_not_duplicate", input.isNotDuplicate);
  }
  if (input.status !== undefined) {
    if (typeof input.status !== "string" || !STATUSES.includes(input.status)) {
      throw invalid("Status must be review or verified");
    }
    assign("status", input.status);
  }
  if (assignments.length === 0) throw invalid("No changes to save");

  const { rowCount } = await pool.query(
    `UPDATE t_transaction SET ${assignments.join(", ")}, updated_time = now()
     WHERE user_id = $1 AND id = $2 AND NOT is_deleted`,
    values,
  );
  if (!rowCount) throw notFound();
  return getTransaction(userId, transactionId);
}

async function getTransaction(userId: string, transactionId: string) {
  const { rows } = await pool.query<TransactionRow>(
    `${SELECT_TRANSACTION}
     WHERE t.user_id = $1 AND t.id = $2 AND NOT t.is_deleted`,
    [userId, transactionId],
  );
  if (!rows[0]) throw notFound();
  return toTransaction(rows[0]);
}

/** An account must belong to the same user, or transactions could reach other users' data. */
async function parseAccount(userId: string, value: unknown) {
  if (isUuid(value)) {
    const { rowCount } = await pool.query(
      "SELECT 1 FROM m_account WHERE user_id = $1 AND id = $2 AND NOT is_deleted",
      [userId, value],
    );
    if (rowCount) return value;
  }
  throw invalid("Choose a valid account");
}

async function parseCategory(userId: string, value: unknown) {
  if (isUuid(value)) {
    const { rows } = await pool.query<{ id: string; type: string }>(
      "SELECT id, type FROM m_category WHERE user_id = $1 AND id = $2 AND NOT is_deleted",
      [userId, value],
    );
    if (rows[0]) return rows[0];
  }
  throw invalid("Choose a valid category");
}

async function parseTransferTarget(
  userId: string,
  value: unknown,
  accountId: string,
) {
  const target = await parseAccount(userId, value);
  if (target === accountId) throw invalid("Choose two different accounts");
  return target;
}
