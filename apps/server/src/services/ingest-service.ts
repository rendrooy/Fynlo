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
import {
  NOTIFICATION_SOURCES,
  notificationSentence,
  type NotificationSource,
  parseNotification,
  UNNAMED_DETAIL,
} from "./ingest-parsers/notification";
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

interface StoredEvent {
  body: string;
  receivedAt: Date;
  sender: null | string;
  source: string;
}

type TransactionSource = "email" | "shortcut";

const SOURCES = ["email"];
const MAX_BODY = 200000;
const MAX_NOTIFICATION = 2000;
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
    return processEvent(client, userId, rows[0].id, {
      body,
      receivedAt: received,
      sender: senderText,
      source,
    });
  });
}

/**
 * Notifications carry no time, so the transaction happens when Fynlo hears about it.
 * Each Shortcut sends its bank and the last digits of its account.
 */
export async function ingestNotification(
  userId: string,
  input: Record<string, unknown>,
) {
  const { account, msg } = input;
  const source =
    typeof input.source === "string" ? input.source.trim().toLowerCase() : "";
  if (!NOTIFICATION_SOURCES.includes(source as NotificationSource)) {
    throw invalid("Source must be jago or bni");
  }
  if (typeof account !== "string" || !/^\d{2,10}$/.test(account.trim())) {
    throw invalid("Account must be the last digits of the account number");
  }
  if (typeof msg !== "string" || !msg.trim() || msg.length > MAX_NOTIFICATION) {
    throw invalid("A notification text is required");
  }
  const received = new Date();
  const sender = `${source}:${account.trim()}`;
  // The same Shortcut firing twice in a minute is one notification.
  const minute = received.toISOString().slice(0, 16);
  const externalId = createHash("sha256")
    .update(`${sender}\n${minute}\n${msg}`)
    .digest("hex");

  return inTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO t_ingest_event
         (user_id, source, external_id, sender, subject, body, received_at, status)
       VALUES ($1, 'notification', $2, $3, $4, $5, $6, 'failed')
       ON CONFLICT (user_id, source, external_id) DO NOTHING
       RETURNING id`,
      [
        userId,
        externalId,
        sender,
        notificationSentence(msg).slice(0, 255) || null,
        msg,
        received,
      ],
    );
    if (!rows[0]) return { status: "duplicate" };
    return processEvent(client, userId, rows[0].id, {
      body: msg,
      receivedAt: received,
      sender,
      source: "notification",
    });
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
      received_at: Date;
      sender: null | string;
      source: string;
      status: string;
    }>(
      `SELECT body, received_at, sender, source, status FROM t_ingest_event
       WHERE user_id = $1 AND id = $2
       FOR UPDATE`,
      [userId, eventId],
    );
    const event = rows[0];
    if (!event) throw new HttpError(404, "Message not found");
    if (event.status !== "failed" && event.status !== "unmatched") {
      throw new HttpError(409, "This message has already been handled");
    }
    return processEvent(client, userId, eventId, {
      body: event.body,
      receivedAt: event.received_at,
      sender: event.sender,
      source: event.source,
    });
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
    source: TransactionSource;
    toAccountId: null | string;
    type: string;
  },
) {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO t_transaction
       (user_id, account_id, to_account_id, category_id, type, amount, name, detail,
        occurred_at, source, status, reference)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
             $9::timestamp AT TIME ZONE '${TIME_ZONE}', $11, 'review', $10)
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
      fields.source,
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

/** YYYY-MM-DD and HH:mm:ss of a moment in Jakarta. */
function jakartaTime(moment: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone: TIME_ZONE,
      year: "numeric",
    })
      .formatToParts(moment)
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

/**
 * Moving money between the user's own banks shows up as two notifications, one per bank.
 * The second one turns the first into a transfer, as long as one side names the user
 * and the other side names the user too or nobody at all.
 */
async function pairOwnTransfer(
  client: PoolClient,
  userId: string,
  accountId: string,
  at: string,
  message: ParsedBankMessage,
) {
  const { rows: owner } = await client.query<{ name: string }>(
    "SELECT name FROM m_user WHERE id = $1",
    [userId],
  );
  const ownName = owner[0]?.name.trim().toLowerCase() ?? "";
  if (!ownName) return null;
  const isOwn = message.counterpartyName.toLowerCase().includes(ownName);
  const isUnnamed = message.detail === UNNAMED_DETAIL;
  if (!isOwn && !isUnnamed) return null;

  const { rows } = await client.query<{ account_id: string; id: string }>(
    `SELECT t.id, t.account_id FROM t_transaction t
     WHERE t.user_id = $1 AND NOT t.is_deleted AND t.source = 'shortcut'
       AND t.type = $2 AND t.account_id <> $3 AND t.amount = $4
       AND abs(extract(epoch FROM t.occurred_at - ($5::timestamp AT TIME ZONE '${TIME_ZONE}'))) <= ${MATCH_WINDOW_SECONDS}
       AND (position($6 IN lower(t.name)) > 0 OR ($7 AND t.detail = $8))`,
    [
      userId,
      message.type === "income" ? "expense" : "income",
      accountId,
      message.amount,
      at,
      ownName,
      isOwn,
      UNNAMED_DETAIL,
    ],
  );
  const other = rows[0];
  if (rows.length !== 1 || !other) return null;
  const [from, to] =
    message.type === "income"
      ? [other.account_id, accountId]
      : [accountId, other.account_id];
  await client.query(
    `UPDATE t_transaction
     SET type = 'transfer', account_id = $2, to_account_id = $3, category_id = NULL,
         updated_time = now()
     WHERE id = $1`,
    [other.id, from, to],
  );
  return other.id;
}

function parseMessage(event: StoredEvent): ParseResult {
  if (event.source === "notification") {
    const [source, accountNumber] = (event.sender ?? "").split(":");
    if (!NOTIFICATION_SOURCES.includes(source as NotificationSource)) {
      return { reason: "This notification has no bank", status: "failed" };
    }
    return parseNotification(source as NotificationSource, event.body, {
      accountNumber: accountNumber ?? "",
      ...jakartaTime(event.receivedAt),
    });
  }
  const lines = htmlToLines(event.body);
  const from = (event.sender ?? "").toLowerCase();
  if (from.includes("@jago.com")) return parseJagoEmail(lines);
  if (from.includes("@bni.co.id")) return parseWondrEmail(lines);
  return { status: "ignored" };
}

async function processEvent(
  client: PoolClient,
  userId: string,
  eventId: string,
  event: StoredEvent,
) {
  const result = parseMessage(event);
  if (result.status === "ignored") {
    return finishEvent(client, eventId, "ignored", null, null);
  }
  if (result.status === "failed") {
    return finishEvent(client, eventId, "failed", result.reason, null);
  }
  return recordMessage(
    client,
    userId,
    eventId,
    event.source === "notification" ? "shortcut" : "email",
    result.message,
  );
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
    source: "email",
    toAccountId: null,
    type: "expense",
  });
}

async function recordMessage(
  client: PoolClient,
  userId: string,
  eventId: string,
  source: TransactionSource,
  message: ParsedBankMessage,
) {
  const { rows: accounts } = await client.query<{
    id: string;
    mask: null | string;
    name: string;
  }>(
    "SELECT id, mask, name FROM m_account WHERE user_id = $1 AND NOT is_deleted",
    [userId],
  );
  // The visible digits and the saved last 4 digits can each be the shorter one.
  const owners = (number: null | string) =>
    number
      ? accounts.filter(
          (a) => a.mask && (number.endsWith(a.mask) || a.mask.endsWith(number)),
        )
      : [];
  const pocketName = (name: string) =>
    name
      .toLowerCase()
      .replace(/^kantong\s+/, "")
      .trim();
  const pockets = message.sourceName
    ? accounts.filter(
        (a) => pocketName(a.name) === pocketName(message.sourceName as string),
      )
    : [];
  const sources = pockets.length === 1 ? pockets : owners(message.sourceNumber);
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

  if (source === "shortcut") {
    const paired = await pairOwnTransfer(
      client,
      userId,
      account.id,
      at,
      message,
    );
    if (paired) return finishEvent(client, eventId, "merged", null, paired);
  }

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
         WHERE e.transaction_id = t.id AND e.id <> $6 AND e.source = $7
       )`,
    [
      userId,
      account.id,
      message.amount,
      at,
      message.type,
      eventId,
      source === "shortcut" ? "notification" : "email",
    ],
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
    source,
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
