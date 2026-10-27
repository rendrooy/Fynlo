# Personal Finance Tracker

> A private, self-hosted personal finance dashboard that records bank transactions automatically where possible, with a lightweight weekly correction workflow.

**Status:** Planning / MVP  
**Working name:** Personal Finance Tracker (branding TBD)  
**Primary locale:** Indonesian (`id-ID`), currency IDR, timezone `Asia/Jakarta`.

## 1. Product overview

This is a **personal hobby project**, not an enterprise banking or open-banking integration. The user currently banks with **Bank Jago**, **BNI / wondr**, and potentially other Indonesian banks. Their daily device is an **iPhone running iOS 27**.

The main goal is to capture income and expenses **automatically without daily manual input**. Missing or incorrectly classified transactions may be fixed during a **weekly review**. We prefer a simple, secure, maintainable system over costly enterprise integrations.

### Success criteria

- Receive eligible transaction events automatically from iOS Shortcuts and, optionally, bank transaction emails.
- Support Bank Jago and BNI / wondr first; make parsers extensible to other banks.
- Record debit, credit, merchant/description, transaction time, account, amount, category and source when available.
- Never double-count the same transaction just because it was reported by multiple sources.
- Distinguish transfers between owned accounts from income and expenses.
- Offer a dashboard for cash flow, spending categories, account activity and monthly totals.
- Offer a weekly review to add, edit, delete/ignore or merge erroneous/missing transactions.
- Clearly show whether a transaction is inferred from notifications/email or reconciled against a bank statement.

### Non-goals for the MVP

- Enterprise bank APIs, SNAP business onboarding, BNI Direct, or commercial partnership flows.
- Scraping authenticated banking websites, bypassing OTP/CAPTCHA, or storing banking login credentials.
- Accessing bank data that the bank or operating system does not legitimately expose.
- Native Android client or MacroDroid integration (deferred).
- AI-driven transaction parsing, verification or categorization; start rule-based.
- Claiming complete real-time bank ledger coverage.

## 2. Reliability and platform assumptions (IMPORTANT)

**Do not assume every Jago/wondr transaction sends a push notification or email.** A transaction that produces neither cannot be detected by the ingestion API.

**Do not assume iOS 27 exposes arbitrary third-party notification title/body to Shortcuts without testing on the actual device.** Treat notification automation availability, usable output fields and lock-screen/background execution as **unverified integration hypotheses until a proof of concept confirms them**. Never implement an imaginary iOS action or undocumented entitlement.

The MVP should start with a **device-side proof of concept**:

1. Verify the Notification automation trigger exists in the user's installed Shortcuts version.
2. Verify Jago and wondr can be selected as the trigger app(s).
3. Verify which notification fields (if any) the automation can actually read.
4. Verify an HTTPS POST is emitted with the iPhone locked/unlocked and on Wi-Fi/cellular.
5. Compare a small set of known test transactions against events received by the API.
6. If notification data cannot be captured reliably, switch to available email alerts as primary automated ingestion; document the remaining coverage gaps.

**Automation is a best-effort acquisition mechanism, not a guarantee of 100% complete data.** The product should favor automated daily capture plus weekly corrections, and explain coverage uncertainty in its UI.

## 3. Recommended stack

| Layer | Technology |
|---|---|
| Web UI + API | Next.js (App Router), TypeScript |
| UI | Tailwind CSS |
| Database | PostgreSQL |
| Database access | Prisma ORM |
| Runtime validation | Zod |
| iOS integration | Apple Shortcuts, subject to PoC validation |
| Optional email integration | Gmail API with OAuth 2.0, least-privilege scope and scheduled reconciliation |
| Scheduling | A simple cron/scheduled job if required |
| Testing | Vitest for domain logic; integration tests for API/database |

Avoid unnecessary microservices, message brokers, complex cloud services and AI in the MVP. Use a modest background worker only when asynchronous processing becomes justified.

## 4. High-level architecture

```mermaid
flowchart TD
    J[Bank Jago / BNI wondr] --> N[Possible iOS bank notification]
    J --> E[Possible transaction email]
    N --> S[iOS Shortcuts - subject to device PoC]
    E --> G[Optional Gmail connector]
    S --> I[Next.js ingestion API]
    G --> I
    I --> V[Auth + schema validation + raw event storage]
    V --> P[Bank-specific parser]
    P --> M[Normalize + candidate matching]
    M --> D[(PostgreSQL)]
    D --> U[Dashboard]
    D --> W[Weekly review and correction]
    W --> D
```

Email and notifications are **alternative capture paths**, not a requirement for two-source verification. A match from two alert sources is still **not the same as bank-statement reconciliation**.

## 5. User journeys

### Automated daily capture

1. User makes a transaction with Jago or wondr.
2. If the bank generates a supported notification, a verified iOS automation sends a request to the ingestion endpoint.
3. If the bank generates a supported transaction email and Gmail is connected, the email connector can independently ingest it.
4. Backend authenticates the source, validates the payload, stores a raw event and attempts rule-based parsing.
5. Parser creates or updates a normalized transaction candidate; duplicate signals are linked rather than double-counted.
6. Dashboard displays the transaction with a source and verification status.

### Weekly review

1. User opens **Review** and filters unparsed, ambiguous, unverified and suspected duplicate entries.
2. User compares dashboard entries with their actual banking activity or statement if necessary.
3. User adds missing records or edits/merges/ignores existing ones.
4. Changes are audited. Manually corrected data is not silently overwritten by later ingestions.

## 6. API contracts

### `POST /api/v1/banking/notifications`

Accepts source-authenticated raw event data. The endpoint must be accessible over HTTPS and must **persist raw events before acknowledging successful ingestion**.

Example request (sample data only; not a verified bank notification format):

```http
POST /api/v1/banking/notifications HTTP/1.1
Authorization: Bearer <device-specific-token>
Content-Type: application/json
```

```json
{
  "eventId": "9e25dd54-a6bd-4b5a-8892-8091fffae874",
  "source": "IOS_SHORTCUT",
  "app": "Jago",
  "title": "Transaksi berhasil",
  "subtitle": "",
  "body": "Pembayaran Rp35.000 berhasil",
  "capturedAt": "2026-10-27T09:00:00+07:00"
}
```

`eventId` should be generated on the device **if feasible**; the backend must also guard against retries and repeated content. If a field is unavailable on iOS, omit it rather than fabricating values. The API must support partial notification metadata and record parse failures without losing the event.

Example accepted response:

```json
{
  "success": true,
  "eventId": "evt_123",
  "status": "RECEIVED"
}
```

Suggested responses:

- `202 Accepted`: Event durably stored for processing.
- `400 Bad Request`: Invalid schema.
- `401 Unauthorized`: Invalid/missing source credential.
- `413 Payload Too Large`: Payload exceeds configured limit.
- `429 Too Many Requests`: Rate limit exceeded.

Do not return `202` until the raw event has been committed successfully. Avoid logging raw financial notification text and credentials.

### Suggested application endpoints

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v1/accounts` | List owned bank accounts/pockets |
| GET | `/api/v1/transactions` | Filter/paginate transactions |
| POST | `/api/v1/transactions` | Manually add a missing transaction |
| PATCH | `/api/v1/transactions/:id` | Correct a transaction |
| POST | `/api/v1/transactions/:id/merge` | Merge confirmed duplicates |
| POST | `/api/v1/transactions/:id/ignore` | Exclude an invalid event |
| GET | `/api/v1/review` | Weekly review queue |
| GET | `/api/v1/dashboard/summary` | Income/expense/net flows by period |

Add authentication/authorization for every endpoint and CSRF protections where cookie-based sessions apply.

## 7. Data model

Use integer minor units for IDR amounts (or Prisma Decimal consistently), **never JavaScript floats for money**.

### `bank_accounts`

- `id`, `bankCode` (`JAGO`, `BNI`, `OTHER`), `name`, `currency`, `isOwned`, `createdAt`
- Optional `parentAccountId` for Jago pockets/sub-accounts.
- Optional **masked** bank account identifier; no plaintext banking login secrets.

### `raw_ingestion_events`

- `id`, `source`, `sourceEventId`, `appName`, `title`, `subtitle`, `body`, `capturedAt`, `receivedAt`
- `payloadHash`, `parserVersion`, `processingStatus`, `parseErrorCode`
- Sensitive source payload encrypted at rest and retained for a limited, configurable period.
- Unique constraints/idempotency designed per source; never use content hash alone to suppress legitimate repeated purchases.

### `transactions`

- `id`, `bankAccountId`, `occurredAt`, `amountMinor`, `direction` (`DEBIT` / `CREDIT`)
- `kind` (`INCOME` / `EXPENSE` / `TRANSFER` / `UNCATEGORIZED`)
- `description`, `merchant`, `categoryId`, `bankReference` (nullable)
- `reviewStatus` (`UNREVIEWED` / `REVIEWED` / `NEEDS_ATTENTION`)
- `verificationStatus` (`ALERT_ONLY` / `MULTI_SOURCE_MATCHED` / `STATEMENT_RECONCILED`)
- `createdAt`, `updatedAt`, `manuallyEditedAt` (nullable)

### `transaction_sources`

- `id`, `transactionId`, `rawEventId`, `matchMethod`, `linkedAt`
- Support **many events to one transaction** without losing provenance.

### Other tables

- `categories` and `categorization_rules`
- `sync_runs` / `source_health` for connector failures, latest successful event and errors
- `transaction_audit_logs` for manual corrections/merges/ignores
- `weekly_reviews` for review periods and completion status

## 8. Parsing, matching and accounting rules

1. Implement parsers behind a `BankEventParser` interface: Jago, BNI and generic fallback.
2. First validate **source, bank, currency, amount, direction, transaction time and available references**.
3. Preserve both event receive time and claimed bank transaction time; they are not interchangeable.
4. First attempt a deterministic match using a **verified bank reference + account** when available.
5. Otherwise consider account, amount, direction, time window and normalized description/merchant.
6. If matching is ambiguous (e.g. two same-amount QRIS payments), **do not auto-merge**; flag for review.
7. Different phones/emails may report the same transfer; attach sources to one logical transaction only when sufficiently certain.
8. Transfers between owned accounts must not inflate aggregate income or expenses.
9. A Jago transfer between pockets is an internal transfer, not consumption.
10. If parsing fails, keep the raw event with `UNPARSED` status and display it in the review queue.
11. Categories should start with deterministic merchant/rule mappings and manual overrides.
12. Weekly user corrections take precedence over automatic parser guesses.

Suggested parser interface:

```typescript
export interface BankEventParser {
  supports(event: RawBankEvent): boolean;
  parse(event: RawBankEvent): ParsedTransactionCandidate | null;
}
```

Store event-source attribution and avoid assigning `STATEMENT_RECONCILED` unless compared to a real statement/ledger source.

## 9. Pages / UI

- **Overview:** current month income, expense, net cash flow, trends, spending by category.
- **Transactions:** filter by bank/account/date/category/direction/status; details with original source provenance.
- **Accounts:** Jago, BNI/wondr, optional additional accounts and Jago pockets.
- **Weekly Review:** unparsed items, ambiguous matches, possible duplicates and manual corrections.
- **Settings / Connections:** enabled sources, source health, device token management, optional Gmail connector.

Display `Asia/Jakarta` dates for the user while storing unambiguous UTC timestamps internally. All financial calculations should respect IDR and the selected account ownership.

## 10. Security and privacy

This application handles sensitive personal financial data.

- Self-host and restrict access to a single authorized user for the MVP.
- Use HTTPS only; never hardcode production secrets in source control or Shortcuts screenshots.
- Issue per-device ingestion tokens and support rotation/revocation; validate tokens with timing-safe comparison.
- Do not store banking passwords, PINs, OTPs, browser cookies or session credentials.
- If Gmail integration is enabled, use OAuth scopes limited to the needed functionality and encrypt refresh tokens.
- Validate requests with Zod; enforce maximum payload size, request throttling and database constraints.
- Encrypt sensitive at-rest fields or limit stored raw data, and set a retention period.
- Never print full transaction notification bodies in production logs.
- Do not expose the ingestion API's credentials in client-visible dashboard JavaScript.
- Ensure all edits and merges are attributable and reversible/auditable.

## 11. Implementation plan for Codex Cloud

**Build incrementally; do not implement the entire product at once.**

### Phase 0 — Validate feasibility first

- [ ] Create a minimal API endpoint that durably persists test ingestion events.
- [ ] Document exact Shortcuts setup steps based on verified iOS 27 behavior.
- [ ] Run a real-device test for bank notification automation and accessible variables.
- [ ] Capture *redacted* representative Jago/wondr samples to design parsers.
- [ ] Record known gaps before claiming automatic capture works.

**Exit criterion:** At least one real iOS event reaches the API end-to-end, or the documentation clearly records why it cannot and a realistic alternate source is chosen.

### Phase 1 — Backend foundation

- [ ] Initialize Next.js, TypeScript, Tailwind, Prisma and PostgreSQL.
- [ ] Add `.env.example`, schema migrations, seed data and setup scripts.
- [ ] Add device-authenticated ingestion endpoint, validation and rate limiting.
- [ ] Store raw events, support idempotency and show sync status.
- [ ] Add tests for authentication, invalid payloads and retry behavior.

### Phase 2 — Parsing and transactions

- [ ] Build bank parser interface and redacted fixture-based tests.
- [ ] Add Jago and BNI parsers only for **observed**, verified message patterns.
- [ ] Add normalized transactions, source links, ambiguity handling and categories.
- [ ] Add internal-transfer detection including Jago pockets.
- [ ] Test duplicates, repeated identical purchases, timezone boundaries and parse failures.

### Phase 3 — Dashboard and weekly review

- [ ] Create overview, transactions, accounts and review pages.
- [ ] Add filtering, manual entry/edit/ignore/merge and audit history.
- [ ] Clearly distinguish `ALERT_ONLY` from `STATEMENT_RECONCILED`.
- [ ] Calculate cash flow without double-counting internal transfers.

### Phase 4 — Optional email fallback

- [ ] Confirm which Jago and BNI transaction alert emails actually exist for the user.
- [ ] Implement opt-in Gmail OAuth ingestion if useful.
- [ ] Reuse the existing normalization/matching pipeline.
- [ ] Add scheduled connector health checks and error reporting.

### Phase 5 — Optional statement reconciliation

- [ ] Add a manual statement import as a **weekly correction aid**, not a daily requirement.
- [ ] Reconcile captured transactions with the imported official statement.
- [ ] Flag missing/extra transactions and balance inconsistencies.

## 12. Developer setup (target workflow)

> These commands describe the intended development workflow **after the project is bootstrapped**. The repository may not yet contain the corresponding scripts.

```bash
cp .env.example .env.local
npm install
npx prisma migrate dev
npm run dev
```

Recommended environment variables:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/personal_finance"
BANK_INGEST_TOKEN="replace-with-a-long-random-secret"
# Optional, only when implementing Gmail OAuth:
# GOOGLE_CLIENT_ID=""
# GOOGLE_CLIENT_SECRET=""
# GOOGLE_REDIRECT_URI=""
```

Before considering the MVP usable, the codebase should include automated tests and documented local run instructions.

## 13. Instructions for coding agents

When working in this repository:

1. Read this README and inspect existing code before making changes.
2. Prefer small, reviewable changes; follow the phase sequence above.
3. Do **not** assume iOS bank-notification payloads or automation capabilities without real device evidence.
4. Do **not** invent bank integration APIs, merchant identifiers, notification formats or confirmed sync guarantees.
5. Keep backend ingestion, source adapters, matching, accounting rules and UI concerns separated.
6. Use TypeScript strict mode, Zod validation, clear error handling and database migrations.
7. Cover financial logic, deduplication and transfers with tests; use **synthetic or redacted** fixtures only.
8. Never commit real banking data, secrets, OTPs or Gmail tokens.
9. If external access or a bank/iOS capability is unavailable in the coding environment, implement mocks/test harnesses and clearly document the pending real-device verification rather than claiming success.
10. Do not introduce AI services, Android support or enterprise banking infrastructure without an explicit change in scope.

## 14. Open questions

- Can the user's iOS 27 Shortcuts installation actually expose Jago/wondr notification content and trigger an automatic HTTPS request under normal device conditions?
- Which types of Jago/wondr transactions generate usable push notifications and/or emails?
- Can the source event include a stable bank transaction reference, or only amount and human-readable text?
- How should source health be surfaced without falsely flagging "no transactions" as a failure?
- What name and branding should replace the project working title?

---

**Product principle:** Automate daily capture, tolerate uncertainty transparently, and make weekly correction simple. This is a personal tool, not a bank ledger or an enterprise banking platform.
