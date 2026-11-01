import { pool } from "../connection/db";
import { HttpError } from "../utils/http-error";
import { isUuid } from "../utils/validation";
import {
  createTransaction,
  parseDetail,
  parseOccurredAt,
  TIME_ZONE,
} from "./transaction-service";

const CATEGORY = "Difference";
const GROUP = "Adjustment";
const COLOR = "#64748b";
const ICON = "tag";
const MAX_BALANCE = 1e15;

const invalid = (message: string) => new HttpError(400, message);

const formatRupiah = (value: number) =>
  `${value < 0 ? "-" : ""}Rp${new Intl.NumberFormat("id-ID").format(Math.abs(value))}`;

/** Sets an account's balance on a date by recording the gap as an ordinary transaction. */
export async function adjustAccountBalance(
  userId: string,
  accountId: string,
  input: Record<string, unknown>,
) {
  const target = input.balance;
  if (
    typeof target !== "number" ||
    !Number.isFinite(target) ||
    Math.abs(target) >= MAX_BALANCE ||
    Math.round(target * 100) / 100 !== target
  ) {
    throw invalid("Balance must be a valid amount with at most 2 decimals");
  }
  if (!isUuid(accountId)) throw new HttpError(404, "Account not found");
  parseOccurredAt(input.date, "00:00");
  const date = input.date as string;
  const note = parseDetail(input.note);

  const { rows } = await pool.query<{
    balance: string;
    now_time: string;
    today: string;
  }>(
    `SELECT a.opening_balance + COALESCE(SUM(
              CASE WHEN t.to_account_id = a.id OR t.type = 'income' THEN t.amount
                   ELSE -t.amount END), 0) AS balance,
            to_char(now() AT TIME ZONE '${TIME_ZONE}', 'YYYY-MM-DD') AS today,
            to_char(now() AT TIME ZONE '${TIME_ZONE}', 'HH24:MI') AS now_time
     FROM m_account a
     LEFT JOIN t_transaction t
       ON (t.account_id = a.id OR t.to_account_id = a.id) AND NOT t.is_deleted
      AND (t.occurred_at AT TIME ZONE '${TIME_ZONE}')::date <= $3::date
     WHERE a.user_id = $1 AND a.id = $2 AND NOT a.is_deleted
     GROUP BY a.id`,
    [userId, accountId, date],
  );
  const row = rows[0];
  if (!row) throw new HttpError(404, "Account not found");
  if (date > row.today) throw invalid("The date can't be in the future");

  const current = Math.round(Number(row.balance) * 100) / 100;
  const difference = Math.round((target - current) * 100) / 100;
  if (difference === 0) throw invalid("This balance already matches");

  const categoryId = await differenceCategory(
    userId,
    difference > 0 ? "income" : "expense",
  );
  const change = `${formatRupiah(current)} → ${formatRupiah(target)}`;
  return createTransaction(userId, {
    accountId,
    amount: Math.abs(difference),
    categoryId,
    date,
    detail: note ? `${change} · ${note}` : change,
    name: "Balance adjustment",
    // On a past date it comes last, so it corrects that whole day.
    time: date === row.today ? row.now_time : "23:59",
  });
}

/** Each type has its own Difference category, made the first time it's needed. */
async function differenceCategory(userId: string, type: string) {
  const { rows: found } = await pool.query<{ id: string }>(
    `SELECT id FROM m_category
     WHERE user_id = $1 AND type = $2 AND lower(name) = lower($3) AND NOT is_deleted`,
    [userId, type, CATEGORY],
  );
  if (found[0]) return found[0].id;

  const { rows: groups } = await pool.query<{ id: string }>(
    `WITH made AS (
       INSERT INTO m_category_group (user_id, name, type)
       VALUES ($1, $3, $2)
       ON CONFLICT (user_id, type, lower(name)) WHERE NOT is_deleted DO NOTHING
       RETURNING id
     )
     SELECT id FROM made
     UNION ALL
     SELECT id FROM m_category_group
     WHERE user_id = $1 AND type = $2 AND lower(name) = lower($3) AND NOT is_deleted
     LIMIT 1`,
    [userId, type, GROUP],
  );
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO m_category (user_id, group_id, name, type, icon, color)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [userId, groups[0]?.id, CATEGORY, type, ICON, COLOR],
  );
  return (rows[0] as { id: string }).id;
}
