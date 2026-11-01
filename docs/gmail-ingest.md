# Gmail to Fynlo

Sends transaction emails from Jago and wondr to Fynlo every 5 minutes. It needs the API to be reachable from the internet, so `localhost` won't work.

## Before you start

Every bank account in Fynlo needs its last 4 digits (`mask`), because emails are matched to accounts by number. A Jago pocket uses the last 4 digits of its pocket ID.

## Setup

1. In Fynlo, open **Settings → Automation → New Token** and copy the token. It is shown only once.
2. Go to [script.google.com](https://script.google.com) with the Gmail account that receives the emails, and create a new project.
3. Replace the code with the contents of `gmail-ingest.gs`.
4. Open **Project Settings → Script Properties** and add:
   - `FYNLO_API_URL`: your API address ending in `/v1`
   - `FYNLO_TOKEN`: the token from step 1
5. Select `sendBankEmails` and press **Run**. Allow the permissions it asks for.
6. Open **Triggers → Add Trigger**, choose `sendBankEmails`, time-driven, every 5 minutes.

## Checking that it works

Make a small transaction, wait a few minutes, then open **Settings → Automation → Recent messages**.

| Status          | Meaning                                      | What to do                                                |
| --------------- | -------------------------------------------- | --------------------------------------------------------- |
| Recorded        | A new transaction was created                | Confirm it in Review                               |
| Matched         | It joined a transaction that already existed | Nothing                                                   |
| Check duplicate | Other transactions look the same             | Check them in Review                               |
| No account      | No account has these last 4 digits           | Fill in the account's last 4 digits, then press Retry     |
| Couldn't read   | The email format isn't supported yet         | Share a sample so a parser can be added, then press Retry |
| Ignored         | It isn't a transaction, such as a promotion  | Nothing                                                   |

## If a token leaks

Revoke it in **Settings → Automation** and create a new one. A token can only send messages, and can't read your data.
