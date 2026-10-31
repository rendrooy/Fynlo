import { pool } from "../connection/db";
import { HttpError } from "../utils/http-error";
import { isUuid } from "../utils/validation";

interface BudgetPeriodRow {
  end_date: null | string;
  id: string;
  interval_count: number;
  name: string;
  start_date: string;
  unit: string;
}

const UNIQUE_VIOLATION = "23505";
const UNITS = ["day", "month", "once", "week", "year"];
const MAX_INTERVAL = 365;
const COLUMNS = `id, name, unit, interval_count,
  to_char(start_date, 'YYYY-MM-DD') AS start_date,
  to_char(end_date, 'YYYY-MM-DD') AS end_date`;

// 3 January 2000 is a Monday, so the default week runs Monday to Sunday.
export const DEFAULT_BUDGET_PERIODS = [
  { name: "Weekly", startDate: "2000-01-03", unit: "week" },
  { name: "Monthly", startDate: "2000-01-01", unit: "month" },
  { name: "Yearly", startDate: "2000-01-01", unit: "year" },
];

const toPeriod = (row: BudgetPeriodRow) => ({
  endDate: row.end_date,
  id: row.id,
  intervalCount: row.interval_count,
  name: row.name,
  startDate: row.start_date,
  unit: row.unit,
});

const invalid = (message: string) => new HttpError(400, message);
const notFound = () => new HttpError(404, "Budget period not found");

export async function createBudgetPeriod(
  userId: string,
  input: Record<string, unknown>,
) {
  const period = parsePeriod(input);
  try {
    const { rows } = await pool.query<BudgetPeriodRow>(
      `INSERT INTO m_budget_period (user_id, name, unit, interval_count, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COLUMNS}`,
      [
        userId,
        period.name,
        period.unit,
        period.intervalCount,
        period.startDate,
        period.endDate,
      ],
    );
    return toPeriod(rows[0] as BudgetPeriodRow);
  } catch (error) {
    rethrowDuplicate(error);
  }
}

export async function deleteBudgetPeriod(userId: string, periodId: string) {
  if (!isUuid(periodId)) throw notFound();
  // The NOT EXISTS keeps the in-use check and the delete in a single statement.
  const { rowCount } = await pool.query(
    `UPDATE m_budget_period p SET is_deleted = true, updated_time = now()
     WHERE p.user_id = $1 AND p.id = $2 AND NOT p.is_deleted
       AND NOT EXISTS (SELECT 1 FROM m_budget b WHERE b.period_id = p.id)`,
    [userId, periodId],
  );
  if (rowCount) return;
  const { rowCount: exists } = await pool.query(
    "SELECT 1 FROM m_budget_period WHERE user_id = $1 AND id = $2 AND NOT is_deleted",
    [userId, periodId],
  );
  if (!exists) throw notFound();
  throw new HttpError(409, "Move or delete the budgets in this period first");
}

export async function listBudgetPeriods(userId: string) {
  const { rows } = await pool.query<BudgetPeriodRow>(
    `SELECT ${COLUMNS} FROM m_budget_period
     WHERE user_id = $1 AND NOT is_deleted
     ORDER BY created_time, start_date, name`,
    [userId],
  );
  return rows.map(toPeriod);
}

export async function updateBudgetPeriod(
  userId: string,
  periodId: string,
  input: Record<string, unknown>,
) {
  const period = parsePeriod(input);
  if (!isUuid(periodId)) throw notFound();
  try {
    const { rows } = await pool.query<BudgetPeriodRow>(
      `UPDATE m_budget_period
       SET name = $3, unit = $4, interval_count = $5, start_date = $6,
           end_date = $7, updated_time = now()
       WHERE user_id = $1 AND id = $2 AND NOT is_deleted
       RETURNING ${COLUMNS}`,
      [
        userId,
        periodId,
        period.name,
        period.unit,
        period.intervalCount,
        period.startDate,
        period.endDate,
      ],
    );
    if (!rows[0]) throw notFound();
    return toPeriod(rows[0]);
  } catch (error) {
    rethrowDuplicate(error);
  }
}

function isDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    // A rolled-over date such as February 31 comes back different.
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

function parsePeriod(input: Record<string, unknown>) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 50) {
    throw invalid("Name must have 1 to 50 characters");
  }
  const { intervalCount, unit } = input;
  if (typeof unit !== "string" || !UNITS.includes(unit)) {
    throw invalid("Choose a valid repeat");
  }
  if (!isDate(input.startDate)) throw invalid("Choose a valid start date");
  if (unit === "once") {
    if (!isDate(input.endDate) || input.endDate < input.startDate) {
      throw invalid("The end date can't be before the start date");
    }
    return {
      endDate: input.endDate,
      intervalCount: 1,
      name,
      startDate: input.startDate,
      unit,
    };
  }
  if (
    !Number.isInteger(intervalCount) ||
    (intervalCount as number) < 1 ||
    (intervalCount as number) > MAX_INTERVAL
  ) {
    throw invalid(`Repeat every 1 to ${MAX_INTERVAL}`);
  }
  return {
    endDate: null,
    intervalCount,
    name,
    startDate: input.startDate,
    unit,
  };
}

function rethrowDuplicate(error: unknown): never {
  if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
    throw new HttpError(409, "A period with this name already exists");
  }
  throw error;
}
