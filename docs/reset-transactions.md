# Clearing all transactions

This permanently deletes every transaction for **all users**. Accounts, categories, and budgets stay. It can't be undone unless you have a backup, so check that the Supabase project in your browser is Fynlo first.

Run this in **Supabase → SQL Editor**:

```sql
BEGIN;
SET LOCAL search_path TO fynlo;

TRUNCATE t_ingest_event, t_transaction;

COMMIT;
```

## What changes

| Data                                      | Result                                      |
| ----------------------------------------- | ------------------------------------------- |
| Transactions, including transfers         | Deleted                                     |
| Received bank messages (`t_ingest_event`) | Deleted, because they point to transactions |
| Device tokens                             | Stay                                        |
| Accounts and their opening balances       | Stay                                        |
| Categories, budgets, periods, and groups  | Stay, with budgets showing nothing spent    |

Reload the app afterward.

## Importing again

- **Bank emails:** the Gmail script only looks back 2 days, and remembers what it sent for 6 hours. To send them again now, run `forgetSentEmails` and then `sendBankEmails` in the script. Older emails have to come from a statement PDF.
- **Statement PDFs:** nothing is flagged as a duplicate anymore, so you can import them again.
- **Opening balances:** they aren't reset. An import offers to set the opening balance again when no older transaction exists.

To also set every opening balance back to 0, run this before `COMMIT`:

```sql
UPDATE m_account SET opening_balance = 0, updated_time = now();
```
