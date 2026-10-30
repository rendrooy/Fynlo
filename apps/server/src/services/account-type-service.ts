import { pool } from "../connection/db";
import { HttpError } from "../utils/http-error";
import { isUuid } from "../utils/validation";

interface AccountTypeRow {
  account_count: number;
  id: string;
  name: string;
}

const UNIQUE_VIOLATION = "23505";

export const DEFAULT_ACCOUNT_TYPES = ["Bank account", "Cash", "E-wallet"];

const toAccountType = (row: AccountTypeRow) => ({
  accountCount: row.account_count,
  id: row.id,
  name: row.name,
});

const notFound = () => new HttpError(404, "Account type not found");

export async function createAccountType(
  userId: string,
  input: Record<string, unknown>,
) {
  try {
    const { rows } = await pool.query<AccountTypeRow>(
      `INSERT INTO m_account_type (user_id, name) VALUES ($1, $2)
       RETURNING id, name, 0 AS account_count`,
      [userId, parseName(input.name)],
    );
    return toAccountType(rows[0] as AccountTypeRow);
  } catch (error) {
    rethrowDuplicate(error);
  }
}

export async function deleteAccountType(userId: string, typeId: string) {
  if (!isUuid(typeId)) throw notFound();
  // The NOT EXISTS keeps the in-use check and the delete in a single statement.
  const { rowCount } = await pool.query(
    `UPDATE m_account_type t SET is_deleted = true, updated_time = now()
     WHERE t.user_id = $1 AND t.id = $2 AND NOT t.is_deleted
       AND NOT EXISTS (
         SELECT 1 FROM m_account a
         WHERE a.account_type_id = t.id AND NOT a.is_deleted
       )`,
    [userId, typeId],
  );
  if (rowCount) return;
  const { rowCount: exists } = await pool.query(
    "SELECT 1 FROM m_account_type WHERE user_id = $1 AND id = $2 AND NOT is_deleted",
    [userId, typeId],
  );
  if (!exists) throw notFound();
  throw new HttpError(409, "Move or delete the accounts using this type first");
}

export async function listAccountTypes(userId: string) {
  const { rows } = await pool.query<AccountTypeRow>(
    `SELECT t.id, t.name, count(a.id)::int AS account_count
     FROM m_account_type t
     LEFT JOIN m_account a ON a.account_type_id = t.id AND NOT a.is_deleted
     WHERE t.user_id = $1 AND NOT t.is_deleted
     GROUP BY t.id
     ORDER BY t.created_time, t.name`,
    [userId],
  );
  return rows.map(toAccountType);
}

export async function renameAccountType(
  userId: string,
  typeId: string,
  input: Record<string, unknown>,
) {
  const name = parseName(input.name);
  if (!isUuid(typeId)) throw notFound();
  try {
    const { rows } = await pool.query<AccountTypeRow>(
      `UPDATE m_account_type t SET name = $3, updated_time = now()
       WHERE t.user_id = $1 AND t.id = $2 AND NOT t.is_deleted
       RETURNING t.id, t.name, (
         SELECT count(*)::int FROM m_account a
         WHERE a.account_type_id = t.id AND NOT a.is_deleted
       ) AS account_count`,
      [userId, typeId, name],
    );
    if (!rows[0]) throw notFound();
    return toAccountType(rows[0]);
  } catch (error) {
    rethrowDuplicate(error);
  }
}

function parseName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 50) {
    throw new HttpError(400, "Name must have 1 to 50 characters");
  }
  return name;
}

function rethrowDuplicate(error: unknown): never {
  if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
    throw new HttpError(409, "An account type with this name already exists");
  }
  throw error;
}
