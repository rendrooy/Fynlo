import { pool } from "../connection/db";
import { HttpError } from "../utils/http-error";
import { isUuid } from "../utils/validation";

interface CategoryGroupRow {
  category_count: number;
  id: string;
  name: string;
  type: string;
}

const UNIQUE_VIOLATION = "23505";
const TYPES = ["expense", "income"];

export const DEFAULT_CATEGORY_GROUPS = [
  { name: "Needs", type: "expense" },
  { name: "Lifestyle", type: "expense" },
  { name: "Income", type: "income" },
];

export const DEFAULT_CATEGORIES = [
  { color: "#f59e0b", group: "Needs", icon: "receipt", name: "Bills" },
  { color: "#059669", group: "Needs", icon: "utensils", name: "Food & Drinks" },
  { color: "#e11d48", group: "Needs", icon: "home", name: "Housing" },
  { color: "#0ea5e9", group: "Needs", icon: "car", name: "Transport" },
  { color: "#64748b", group: "Lifestyle", icon: "film", name: "Entertainment" },
  { color: "#8b5cf6", group: "Lifestyle", icon: "bag", name: "Shopping" },
  { color: "#0ea5e9", group: "Income", icon: "laptop", name: "Freelance" },
  { color: "#059669", group: "Income", icon: "wallet", name: "Salary" },
];

const toCategoryGroup = (row: CategoryGroupRow) => ({
  categoryCount: row.category_count,
  id: row.id,
  name: row.name,
  type: row.type,
});

const notFound = () => new HttpError(404, "Category group not found");

export async function createCategoryGroup(
  userId: string,
  input: Record<string, unknown>,
) {
  const name = parseName(input.name);
  if (typeof input.type !== "string" || !TYPES.includes(input.type)) {
    throw new HttpError(400, "Type must be expense or income");
  }
  try {
    const { rows } = await pool.query<CategoryGroupRow>(
      `INSERT INTO m_category_group (user_id, name, type) VALUES ($1, $2, $3)
       RETURNING id, name, type, 0 AS category_count`,
      [userId, name, input.type],
    );
    return toCategoryGroup(rows[0] as CategoryGroupRow);
  } catch (error) {
    rethrowDuplicate(error);
  }
}

export async function deleteCategoryGroup(userId: string, groupId: string) {
  if (!isUuid(groupId)) throw notFound();
  // The NOT EXISTS keeps the in-use check and the delete in a single statement.
  const { rowCount } = await pool.query(
    `UPDATE m_category_group g SET is_deleted = true, updated_time = now()
     WHERE g.user_id = $1 AND g.id = $2 AND NOT g.is_deleted
       AND NOT EXISTS (
         SELECT 1 FROM m_category c
         WHERE c.group_id = g.id AND NOT c.is_deleted
       )`,
    [userId, groupId],
  );
  if (rowCount) return;
  const { rowCount: exists } = await pool.query(
    "SELECT 1 FROM m_category_group WHERE user_id = $1 AND id = $2 AND NOT is_deleted",
    [userId, groupId],
  );
  if (!exists) throw notFound();
  throw new HttpError(409, "Move or delete the categories in this group first");
}

export async function listCategoryGroups(userId: string) {
  const { rows } = await pool.query<CategoryGroupRow>(
    `SELECT g.id, g.name, g.type, count(c.id)::int AS category_count
     FROM m_category_group g
     LEFT JOIN m_category c ON c.group_id = g.id AND NOT c.is_deleted
     WHERE g.user_id = $1 AND NOT g.is_deleted
     GROUP BY g.id
     ORDER BY g.created_time, g.name`,
    [userId],
  );
  return rows.map(toCategoryGroup);
}

export async function renameCategoryGroup(
  userId: string,
  groupId: string,
  input: Record<string, unknown>,
) {
  const name = parseName(input.name);
  if (!isUuid(groupId)) throw notFound();
  try {
    const { rows } = await pool.query<CategoryGroupRow>(
      `UPDATE m_category_group g SET name = $3, updated_time = now()
       WHERE g.user_id = $1 AND g.id = $2 AND NOT g.is_deleted
       RETURNING g.id, g.name, g.type, (
         SELECT count(*)::int FROM m_category c
         WHERE c.group_id = g.id AND NOT c.is_deleted
       ) AS category_count`,
      [userId, groupId, name],
    );
    if (!rows[0]) throw notFound();
    return toCategoryGroup(rows[0]);
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
