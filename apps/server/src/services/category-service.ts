import { pool } from "../connection/db";
import { HttpError } from "../utils/http-error";
import { isUuid } from "../utils/validation";

interface CategoryRow {
  color: string;
  group_id: string;
  group_name: string;
  icon: string;
  id: string;
  in_use: boolean;
  name: string;
  type: string;
}

const UNIQUE_VIOLATION = "23505";
const ICONS = [
  "bag",
  "car",
  "film",
  "home",
  "laptop",
  "receipt",
  "utensils",
  "wallet",
];
const IS_REFERENCED = `(
  EXISTS (
    SELECT 1 FROM t_transaction t
    WHERE t.category_id = c.id AND NOT t.is_deleted
  )
  OR EXISTS (SELECT 1 FROM m_budget b WHERE b.category_id = c.id)
)`;
const SELECT_CATEGORY = `
  SELECT c.id, c.name, c.type, c.icon, c.color, c.group_id,
         g.name AS group_name, ${IS_REFERENCED} AS in_use
  FROM m_category c
  JOIN m_category_group g ON g.id = c.group_id`;

const toCategory = (row: CategoryRow) => ({
  color: row.color,
  groupId: row.group_id,
  groupName: row.group_name,
  icon: row.icon,
  id: row.id,
  inUse: row.in_use,
  name: row.name,
  type: row.type,
});

const invalid = (message: string) => new HttpError(400, message);
const notFound = () => new HttpError(404, "Category not found");

export async function createCategory(
  userId: string,
  input: Record<string, unknown>,
) {
  const name = parseName(input.name);
  const icon = parseIcon(input.icon);
  const color = parseColor(input.color);
  if (!isUuid(input.groupId)) throw invalidGroup();
  try {
    // The category takes its type from the group, so the two can never disagree.
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO m_category (user_id, group_id, name, type, icon, color)
       SELECT g.user_id, g.id, $3, g.type, $4, $5
       FROM m_category_group g
       WHERE g.user_id = $1 AND g.id = $2 AND NOT g.is_deleted
       RETURNING id`,
      [userId, input.groupId, name, icon, color],
    );
    if (!rows[0]) throw invalidGroup();
    return await getCategory(userId, rows[0].id);
  } catch (error) {
    rethrowDuplicate(error);
  }
}

export async function deleteCategory(userId: string, categoryId: string) {
  if (!isUuid(categoryId)) throw notFound();
  // Checking in the same statement means a new reference can't slip in between.
  const { rowCount } = await pool.query(
    `UPDATE m_category c SET is_deleted = true, updated_time = now()
     WHERE c.user_id = $1 AND c.id = $2 AND NOT c.is_deleted
       AND NOT ${IS_REFERENCED}`,
    [userId, categoryId],
  );
  if (rowCount) return;
  const { rowCount: exists } = await pool.query(
    "SELECT 1 FROM m_category WHERE user_id = $1 AND id = $2 AND NOT is_deleted",
    [userId, categoryId],
  );
  if (!exists) throw notFound();
  throw new HttpError(
    409,
    "Move or delete the transactions and budget using this category first",
  );
}

export async function listCategories(userId: string) {
  const { rows } = await pool.query<CategoryRow>(
    `${SELECT_CATEGORY}
     WHERE c.user_id = $1 AND NOT c.is_deleted
     ORDER BY g.created_time, g.name, c.created_time, c.name`,
    [userId],
  );
  return rows.map(toCategory);
}

export async function updateCategory(
  userId: string,
  categoryId: string,
  input: Record<string, unknown>,
) {
  if (!isUuid(categoryId)) throw notFound();

  // Column names come only from this list, never from the request.
  const parsers: Record<string, [string, (value: unknown) => unknown]> = {
    color: ["color", parseColor],
    groupId: ["group_id", (value) => parseGroup(userId, categoryId, value)],
    icon: ["icon", parseIcon],
    name: ["name", parseName],
  };

  const values: unknown[] = [userId, categoryId];
  const assignments: string[] = [];
  for (const [field, [column, parse]] of Object.entries(parsers)) {
    if (input[field] === undefined) continue;
    values.push(await parse(input[field]));
    assignments.push(`${column} = $${values.length}`);
  }
  if (assignments.length === 0) throw invalid("No changes to save");

  try {
    const { rowCount } = await pool.query(
      `UPDATE m_category SET ${assignments.join(", ")}, updated_time = now()
       WHERE user_id = $1 AND id = $2 AND NOT is_deleted`,
      values,
    );
    if (!rowCount) throw notFound();
    return await getCategory(userId, categoryId);
  } catch (error) {
    rethrowDuplicate(error);
  }
}

async function getCategory(userId: string, categoryId: string) {
  const { rows } = await pool.query<CategoryRow>(
    `${SELECT_CATEGORY}
     WHERE c.user_id = $1 AND c.id = $2 AND NOT c.is_deleted`,
    [userId, categoryId],
  );
  if (!rows[0]) throw notFound();
  return toCategory(rows[0]);
}

function invalidGroup() {
  return invalid("Choose a valid group");
}

function parseColor(value: unknown) {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw invalid("Color must be a hex color such as #0f766e");
  }
  return value;
}

/** A group must belong to the same user and match the type transactions already rely on. */
async function parseGroup(userId: string, categoryId: string, value: unknown) {
  if (isUuid(value)) {
    const { rowCount } = await pool.query(
      `SELECT 1
       FROM m_category_group g
       JOIN m_category c ON c.user_id = g.user_id AND c.type = g.type
       WHERE g.user_id = $1 AND g.id = $2 AND NOT g.is_deleted AND c.id = $3`,
      [userId, value, categoryId],
    );
    if (rowCount) return value;
  }
  throw invalidGroup();
}

function parseIcon(value: unknown) {
  if (typeof value !== "string" || !ICONS.includes(value)) {
    throw invalid("Choose a valid icon");
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

function rethrowDuplicate(error: unknown): never {
  if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
    throw new HttpError(409, "A category with this name already exists");
  }
  throw error;
}
