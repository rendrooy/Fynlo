import type { Pool, PoolClient } from "pg";

interface HistoryRow {
  category_id: string;
  count: number;
  detail: null | string;
  name: string;
  type: string;
}

// The same name and description is strong evidence, the name alone needs more.
const NAME_AND_DETAIL = { minSeen: 2, minShare: 0.7 };
const NAME_ONLY = { minSeen: 3, minShare: 0.8 };

/** Reference numbers differ on every row of the same payee. */
const clean = (text: null | string) =>
  (text ?? "")
    .toLowerCase()
    .replace(/id#?\s*\S+/g, " ")
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const fullKey = (type: string, name: string, detail: null | string) =>
  `${type}|${clean(name)}|${clean(detail)}`;
const nameKey = (type: string, name: string) => `${type}|${clean(name)}`;

/** Builds a guesser from past choices. It answers null unless they clearly agree. */
export function createCategoryGuesser(history: HistoryRow[]) {
  const seen = new Map<string, Map<string, number>>();
  const add = (key: string, categoryId: string, count: number) => {
    const counts = seen.get(key) ?? new Map<string, number>();
    counts.set(categoryId, (counts.get(categoryId) ?? 0) + count);
    seen.set(key, counts);
  };
  for (const row of history) {
    if (!clean(row.name)) continue;
    add(fullKey(row.type, row.name, row.detail), row.category_id, row.count);
    add(nameKey(row.type, row.name), row.category_id, row.count);
  }

  const agreed = (
    key: string,
    { minSeen, minShare }: { minSeen: number; minShare: number },
  ) => {
    let total = 0;
    let best: null | string = null;
    let bestCount = 0;
    for (const [categoryId, count] of seen.get(key) ?? []) {
      total += count;
      if (count > bestCount) {
        best = categoryId;
        bestCount = count;
      }
    }
    return total >= minSeen && bestCount / total >= minShare ? best : null;
  };

  return (row: { detail: null | string; name: string; type: string }) =>
    clean(row.name)
      ? (agreed(fullKey(row.type, row.name, row.detail), NAME_AND_DETAIL) ??
        agreed(nameKey(row.type, row.name), NAME_ONLY))
      : null;
}

/** One grouped query per statement or email, so a long history stays cheap to read. */
export async function loadCategoryGuesser(
  db: Pool | PoolClient,
  userId: string,
) {
  const { rows } = await db.query<HistoryRow>(
    `SELECT t.type, t.name, t.detail, t.category_id, count(*)::int AS count
     FROM t_transaction t
     JOIN m_category c ON c.id = t.category_id AND NOT c.is_deleted
     WHERE t.user_id = $1 AND NOT t.is_deleted AND t.type <> 'transfer'
     GROUP BY t.type, t.name, t.detail, t.category_id`,
    [userId],
  );
  return createCategoryGuesser(rows);
}
