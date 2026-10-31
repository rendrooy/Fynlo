import { pool } from "../connection/db";
import { HttpError } from "../utils/http-error";
import { isUuid } from "../utils/validation";

interface BudgetRow {
  category_id: string;
  group_id: string;
  id: string;
  limit_amount: string;
  period_id: string;
}

const UNIQUE_VIOLATION = "23505";
const MAX_LIMIT = 1e15;
const COLUMNS = "id, category_id, period_id, group_id, limit_amount";

const toBudget = (row: BudgetRow) => ({
  categoryId: row.category_id,
  groupId: row.group_id,
  id: row.id,
  limit: Number(row.limit_amount),
  periodId: row.period_id,
});

const invalid = (message: string) => new HttpError(400, message);
const notFound = () => new HttpError(404, "Budget not found");

export async function createBudget(
  userId: string,
  input: Record<string, unknown>,
) {
  const limit = parseLimit(input.limit);
  const periodId = await parseOwned(
    userId,
    "m_budget_period",
    input.periodId,
    "Choose a valid period",
  );
  const groupId = await parseOwned(
    userId,
    "m_budget_group",
    input.groupId,
    "Choose a valid group",
  );
  if (!isUuid(input.categoryId)) throw invalidCategory();
  try {
    // Selecting from the category keeps the ownership and type checks in one statement.
    const { rows } = await pool.query<BudgetRow>(
      `INSERT INTO m_budget (user_id, category_id, period_id, group_id, limit_amount)
       SELECT c.user_id, c.id, $3, $4, $5
       FROM m_category c
       WHERE c.user_id = $1 AND c.id = $2 AND c.type = 'expense' AND NOT c.is_deleted
       RETURNING ${COLUMNS}`,
      [userId, input.categoryId, periodId, groupId, limit],
    );
    if (!rows[0]) throw invalidCategory();
    return toBudget(rows[0]);
  } catch (error) {
    rethrowDuplicate(error);
  }
}

export async function deleteBudget(userId: string, budgetId: string) {
  if (!isUuid(budgetId)) throw notFound();
  const { rowCount } = await pool.query(
    "DELETE FROM m_budget WHERE user_id = $1 AND id = $2",
    [userId, budgetId],
  );
  if (!rowCount) throw notFound();
}

export async function listBudgets(userId: string) {
  const { rows } = await pool.query<BudgetRow>(
    `SELECT ${COLUMNS} FROM m_budget WHERE user_id = $1 ORDER BY created_time`,
    [userId],
  );
  return rows.map(toBudget);
}

/** The category stays fixed: to budget another one, create a new budget. */
export async function updateBudget(
  userId: string,
  budgetId: string,
  input: Record<string, unknown>,
) {
  if (!isUuid(budgetId)) throw notFound();
  const values: unknown[] = [userId, budgetId];
  const assignments: string[] = [];
  const assign = (column: string, value: unknown) => {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  };
  if (input.limit !== undefined) {
    assign("limit_amount", parseLimit(input.limit));
  }
  if (input.periodId !== undefined) {
    assign(
      "period_id",
      await parseOwned(
        userId,
        "m_budget_period",
        input.periodId,
        "Choose a valid period",
      ),
    );
  }
  if (input.groupId !== undefined) {
    assign(
      "group_id",
      await parseOwned(
        userId,
        "m_budget_group",
        input.groupId,
        "Choose a valid group",
      ),
    );
  }
  if (assignments.length === 0) throw invalid("No changes to save");
  try {
    const { rows } = await pool.query<BudgetRow>(
      `UPDATE m_budget SET ${assignments.join(", ")}, updated_time = now()
       WHERE user_id = $1 AND id = $2
       RETURNING ${COLUMNS}`,
      values,
    );
    if (!rows[0]) throw notFound();
    return toBudget(rows[0]);
  } catch (error) {
    rethrowDuplicate(error);
  }
}

function invalidCategory() {
  return invalid("Choose a valid expense category");
}

function parseLimit(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value >= MAX_LIMIT ||
    Math.round(value * 100) / 100 !== value
  ) {
    throw invalid("Limit must be greater than 0 with at most 2 decimals");
  }
  return value;
}

/** `table` is always a constant from this file, never from the request. */
async function parseOwned(
  userId: string,
  table: "m_budget_group" | "m_budget_period",
  value: unknown,
  message: string,
) {
  if (isUuid(value)) {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM ${table} WHERE user_id = $1 AND id = $2 AND NOT is_deleted`,
      [userId, value],
    );
    if (rowCount) return value;
  }
  throw invalid(message);
}

function rethrowDuplicate(error: unknown): never {
  if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
    throw new HttpError(
      409,
      "This category already has a budget for that period",
    );
  }
  throw error;
}
