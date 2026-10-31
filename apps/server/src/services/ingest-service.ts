import type { PoolClient } from "pg";

import { createHash, randomBytes } from "node:crypto";

import { pool } from "../connection/db";
import { HttpError } from "../utils/http-error";
import { isUuid } from "../utils/validation";
import { loadCategoryGuesser } from "./category-guess";
import {
  htmlToLines,
  type ParsedBankMessage,
  parseJagoEmail,
  type ParseResult,
  parseWondrEmail,
} from "./ingest-parsers/email";
import { guessCategory } from "./statement-service";
import { TIME_ZONE } from "./transaction-service";

interface EventRow {
  id: string;
  reason: null | string;
  received_at: Date;
  sender: null | string;
  source: string;
  status: string;
  subject: null | string;
  transaction_id: null | string;
}

type EventStatus =
  "ambiguous" | "created" | "failed" | "ignored" | "merged" | "unmatched";

const SOURCES = ["email"];
const MAX_BODY = 200000;
const RECENT_EVENTS = 100;
// A message and a statement row can differ by a few minutes for one transaction.
const MATCH_WINDOW_SECONDS = 600;
const EVENT_COLUMNS =
  "id, source, sender, subject, status, reason, received_at, transaction_id";

const invalid = (message: string) => new HttpError(400, message);
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const toEvent = (row: EventRow) => ({
  id: row.id,
  reason: row.reason,
  receivedAt: row.received_at.toISOString(),
  sender: row.sender,
  source: row.source,
  status: row.status,
  subject: row.subject,
  transactionId: row.transaction_id,
});

/** The plain token exists only in this response. Only its hash is stored. */
export async function createIngestToken(
  userId: string,
  input: Record<string, unknown>,
) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 50) {
    throw invalid("Name must have 1 to 50 characters");
  }
  const token = `fyn_${randomBytes(32).toString("base64url")}`;
  const { rows } = await pool.query<{ created_time: Date; id: string }>(
    `INSERT INTO m_ingest_token (user_id, name, token_hash)
     VALUES ($1, $2, $3)
     RETURNING id, created_time`,
    [userId, name, hashToken(token)],
  );
  const row = rows[0] as { created_time: Date; id: string };
  return {
    createdTime: row.created_time.toISOString(),
    id: row.id,
    lastUsedTime: null,
    name,
    token,
  };
}

export async function findUserByIngestToken(token: string) {
  const { rows } = await pool.query<{ user_id: string }>(
    `UPDATE m_ingest_token SET last_used_time = now()
     WHERE token_hash = $1 AND NOT is_revoked
     RETURNING user_id`,
    [hashToken(token)],
  );
  return rows[0]?.user_id ?? null;
}

export async function ingestMessage(
  userId: string,
  input: Record<string, unknown>,
) {
  const { body, externalId, receivedAt, sender, source, subject } = input;
  if (typeof source !== "string" || !SOURCES.includes(source)) {
    throw invalid("This source isn't supported");
  }
  if (
    typeof externalId !== "string" ||
    !externalId ||
    externalId.length > 255
  ) {
    throw invalid("A message id is required");
  }
  if (typeof body !== "string" || !body || body.length > MAX_BODY) {
    throw invalid("A message body is required");
  }
  const received = new Date(String(receivedAt));
  if (Number.isNaN(received.getTime())) {
    throw invalid("A valid received time is required");
  }
  const senderText = typeof sender === "string" ? sender.slice(0, 255) : null;
  const subjectText =
    typeof subject === "string" ? subject.slice(0, 255) : null;

  // One transaction, so a crash leaves nothing behind and the sender can retry.
  return inTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO t_ingest_event
         (user_id, source, external_id, sender, subject, body, received_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'failed')
       ON CONFLICT (user_id, source, external_id) DO NOTHING
       RETURNING id`,
      [userId, source, externalId, senderText, subjectText, body, received],
    );
    if (!rows[0]) return { status: "duplicate" };
    return processEvent(client, userId, rows[0].id, senderText, body);
  });
}

export async function listIngestEvents(userId: string) {
  const { rows } = await pool.query<EventRow>(
    `SELECT ${EVENT_COLUMNS} FROM t_ingest_event
     WHERE user_id = $1
     ORDER BY received_at DESC
     LIMIT ${RECENT_EVENTS}`,
    [userId],
  );
  return rows.map(toEvent);
}

export async function listIngestTokens(userId: string) {
  const { rows } = await pool.query<{
    created_time: Date;
    id: string;
    last_used_time: Date | null;
    name: string;
  }>(
    `SELECT id, name, created_time, last_used_time FROM m_ingest_token
     WHERE user_id = $1 AND NOT is_revoked
     ORDER BY created_time`,
    [userId],
  );
  return rows.map((row) => ({
    createdTime: row.created_time.toISOString(),
    id: row.id,
    lastUsedTime: row.last_used_time?.toISOString() ?? null,
    name: row.name,
  }));
}

/** After adding an account or a parser, a stuck message can be read again. */
export async function retryIngestEvent(userId: string, eventId: string) {
  if (!isUuid(eventId)) throw new HttpError(404, "Message not found");
  return inTransaction(async (client) => {
    const { rows } = await client.query<{
      body: string;
      sender: null | string;
      status: string;
    }>(
      `SELECT body, sender, status FROM t_ingest_event
       WHERE user_id = $1 AND id = $2
       FOR UPDATE`,
      [userId, eventId],
    );
    const event = rows[0];
    if (!event) throw new HttpError(404, "Message not found");
    if (event.status !== "failed" && event.status !== "unmatched") {
      throw new HttpError(409, "This message has already been handled");
    }
    return processEvent(client, userId, eventId, event.sender, event.body);
  });
}

export async function revokeIngestToken(userId: string, tokenId: string) {
  if (!isUuid(tokenId)) throw new HttpError(404, "Token not found");
  const { rowCount } = await pool.query(
    `UPDATE m_ingest_token SET is_revoked = true
     WHERE user_id = $1 AND id = $2 AND NOT is_revoked`,
    [userId, tokenId],
  );
  if (!rowCount) throw new HttpError(404, "Token not found");
}

async function createTransaction(
  client: PoolClient,
  userId: string,
  fields: {
    accountId: string;
    amount: number;
    at: string;
    categoryId: null | string;
    detail: string;
    name: string;
    reference: null | string;
    toAccountId: null | string;
    type: string;
  },
) {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO t_transaction
       (user_id, account_id, to_account_id, category_id, type, amount, name, detail,
        occurred_at, source, status, reference)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
             $9::timestamp AT TIME ZONE '${TIME_ZONE}', 'email', 'review', $10)
     RETURNING id`,
    [
      userId,
      fields.accountId,
      fields.toAccountId,
      fields.categoryId,
      fields.type,
      fields.amount,
      fields.name.slice(0, 100),
      fields.detail.slice(0, 255),
      fields.at,
      fields.reference,
    ],
  );
  return (rows[0] as { id: string }).id;
}

async function finishEvent(
  client: PoolClient,
  eventId: string,
  status: EventStatus,
  reason: null | string,
  transactionId: null | string,
) {
  await client.query(
    `UPDATE t_ingest_event
     SET status = $2, reason = $3, transaction_id = $4, updated_time = now()
     WHERE id = $1`,
    [eventId, status, reason, transactionId],
  );
  return { status };
}

async function inTransaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function parseMessage(sender: null | string, body: string): ParseResult {
  const lines = htmlToLines(body);
  const from = (sender ?? "").toLowerCase();
  if (from.includes("@jago.com")) return parseJagoEmail(lines);
  if (from.includes("@bni.co.id")) return parseWondrEmail(lines);
  return { status: "ignored" };
}

async function processEvent(
  client: PoolClient,
  userId: string,
  eventId: string,
  sender: null | string,
  body: string,
) {
  const result = parseMessage(sender, body);
  if (result.status === "ignored") {
    return finishEvent(client, eventId, "ignored", null, null);
  }
  if (result.status === "failed") {
    return finishEvent(client, eventId, "failed", result.reason, null);
  }
  return recordMessage(client, userId, eventId, result.message);
}

async function recordFee(
  client: PoolClient,
  userId: string,
  accountId: string,
  at: string,
  message: ParsedBankMessage,
) {
  if (message.fee <= 0) return;
  await createTransaction(client, userId, {
    accountId,
    amount: message.fee,
    at,
    categoryId: null,
    detail: `Fee for transfer to ${message.counterpartyName}`,
    name: "Biaya admin",
    reference: null,
    toAccountId: null,
    type: "expense",
  });
}

async function recordMessage(
  client: PoolClient,
  userId: string,
  eventId: string,
  message: ParsedBankMessage,
) {
  const { rows: accounts } = await client.query<{
    id: string;
    mask: null | string;
  }>("SELECT id, mask FROM m_account WHERE user_id = $1 AND NOT is_deleted", [
    userId,
  ]);
  // The visible digits and the saved last 4 digits can each be the shorter one.
  const owners = (number: null | string) =>
    number
      ? accounts.filter(
          (a) => a.mask && (number.endsWith(a.mask) || a.mask.endsWith(number)),
        )
      : [];
  const sources = owners(message.sourceNumber);
  const account = sources[0];
  if (sources.length !== 1 || !account) {
    return finishEvent(
      client,
      eventId,
      "unmatched",
      sources.length === 0
        ? `No account ends in ${message.sourceNumber.slice(-4)}`
        : `More than one account ends in ${message.sourceNumber.slice(-4)}`,
      null,
    );
  }

  if (message.reference) {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM t_transaction
       WHERE user_id = $1 AND reference = $2 AND NOT is_deleted`,
      [userId, message.reference],
    );
    if (rows[0]) {
      return finishEvent(client, eventId, "merged", null, rows[0].id);
    }
  }

  const at = `${message.date} ${message.time}`;
  const targets = owners(message.counterpartyNumber).filter(
    (a) => a.id !== account.id,
  );
  const toAccountId = targets.length === 1 ? (targets[0]?.id ?? null) : null;

  // A transaction already backed by the same kind of message is a different one.
  const { rows: candidates } = await client.query<{ id: string }>(
    `SELECT t.id FROM t_transaction t
     WHERE t.user_id = $1 AND NOT t.is_deleted AND t.amount = $3
       AND abs(extract(epoch FROM t.occurred_at - ($4::timestamp AT TIME ZONE '${TIME_ZONE}'))) <= ${MATCH_WINDOW_SECONDS}
       AND (
         (t.type = $5 AND t.account_id = $2)
         OR (t.type = 'transfer' AND $5 = 'expense' AND t.account_id = $2)
         OR (t.type = 'transfer' AND $5 = 'income' AND t.to_account_id = $2)
       )
       AND NOT EXISTS (
         SELECT 1 FROM t_ingest_event e
         WHERE e.transaction_id = t.id AND e.id <> $6
       )`,
    [userId, account.id, message.amount, at, message.type, eventId],
  );

  await recordFee(client, userId, account.id, at, message);

  if (candidates.length === 1 && candidates[0]) {
    const { id } = candidates[0];
    await client.query(
      `UPDATE t_transaction SET reference = COALESCE(reference, $2), updated_time = now()
       WHERE id = $1`,
      [id, message.reference],
    );
    return finishEvent(client, eventId, "merged", null, id);
  }

  const { rows: categories } = await client.query<{
    id: string;
    name: string;
    type: string;
  }>(
    "SELECT id, name, type FROM m_category WHERE user_id = $1 AND NOT is_deleted",
    [userId],
  );
  const name = message.counterpartyName;
  const guessFromHistory = await loadCategoryGuesser(client, userId);
  const row = { detail: message.detail, name, type: message.type };
  const transactionId = await createTransaction(client, userId, {
    accountId: account.id,
    amount: message.amount,
    at,
    categoryId: toAccountId
      ? null
      : (guessFromHistory(row) ?? guessCategory(categories, row)),
    detail: message.detail,
    name,
    reference: message.reference,
    toAccountId,
    type: toAccountId ? "transfer" : message.type,
  });
  // Several look-alikes can't be told apart safely, so the user decides.
  return candidates.length > 1
    ? finishEvent(
        client,
        eventId,
        "ambiguous",
        "Other transactions look the same. Check for a duplicate.",
        transactionId,
      )
    : finishEvent(client, eventId, "created", null, transactionId);
}
