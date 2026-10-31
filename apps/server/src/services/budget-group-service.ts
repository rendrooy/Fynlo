import { pool } from "../connection/db";
import { HttpError } from "../utils/http-error";
import { isUuid } from "../utils/validation";

interface BudgetGroupRow {
  id: string;
  name: string;
}

const UNIQUE_VIOLATION = "23505";

export const DEFAULT_BUDGET_GROUPS = ["Needs", "Wants", "Savings"];

const notFound = () => new HttpError(404, "Budget group not found");

export async function createBudgetGroup(
  userId: string,
  input: Record<string, unknown>,
) {
  try {
    const { rows } = await pool.query<BudgetGroupRow>(
      "INSERT INTO m_budget_group (user_id, name) VALUES ($1, $2) RETURNING id, name",
      [userId, parseName(input.name)],
    );
    return rows[0];
  } catch (error) {
    rethrowDuplicate(error);
  }
}

export async function deleteBudgetGroup(userId: string, groupId: string) {
  if (!isUuid(groupId)) throw notFound();
  // The NOT EXISTS keeps the in-use check and the delete in a single statement.
  const { rowCount } = await pool.query(
    `UPDATE m_budget_group g SET is_deleted = true, updated_time = now()
     WHERE g.user_id = $1 AND g.id = $2 AND NOT g.is_deleted
       AND NOT EXISTS (SELECT 1 FROM m_budget b WHERE b.group_id = g.id)`,
    [userId, groupId],
  );
  if (rowCount) return;
  const { rowCount: exists } = await pool.query(
    "SELECT 1 FROM m_budget_group WHERE user_id = $1 AND id = $2 AND NOT is_deleted",
    [userId, groupId],
  );
  if (!exists) throw notFound();
  throw new HttpError(409, "Move or delete the budgets in this group first");
}

export async function listBudgetGroups(userId: string) {
  const { rows } = await pool.query<BudgetGroupRow>(
    `SELECT id, name FROM m_budget_group
     WHERE user_id = $1 AND NOT is_deleted
     ORDER BY created_time, name`,
    [userId],
  );
  return rows;
}

export async function renameBudgetGroup(
  userId: string,
  groupId: string,
  input: Record<string, unknown>,
) {
  const name = parseName(input.name);
  if (!isUuid(groupId)) throw notFound();
  try {
    const { rows } = await pool.query<BudgetGroupRow>(
      `UPDATE m_budget_group SET name = $3, updated_time = now()
       WHERE user_id = $1 AND id = $2 AND NOT is_deleted
       RETURNING id, name`,
      [userId, groupId, name],
    );
    if (!rows[0]) throw notFound();
    return rows[0];
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
    throw new HttpError(409, "A group with this name already exists");
  }
  throw error;
}
