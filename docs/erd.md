# Fynlo ERD

```mermaid
erDiagram
    m_user ||--o{ m_account : owns
    m_user ||--o{ m_account_type : defines
    m_account_type ||--o{ m_account : groups
    m_user ||--o{ m_asset : owns
    m_user ||--o{ m_category : owns
    m_user ||--o{ m_category_group : defines
    m_category_group ||--o{ m_category : groups
    m_user ||--o{ m_budget : sets
    m_user ||--o{ t_transaction : records
    m_user ||--o{ m_ingest_token : issues
    m_user ||--o{ t_ingest_event : receives
    t_transaction |o--o{ t_ingest_event : "is backed by"
    m_account ||--o{ t_transaction : "holds"
    m_account |o--o{ t_transaction : "receives transfers"
    m_category ||--o{ t_transaction : "classifies"
    m_category ||--o{ m_budget : "is limited by"
    m_user ||--o{ m_budget_period : defines
    m_user ||--o{ m_budget_group : defines
    m_budget_period ||--o{ m_budget : schedules
    m_budget_group ||--o{ m_budget : organizes

    m_user {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar name
        varchar initials
        timestamptz created_time
        timestamptz updated_time
    }

    m_account {
        uuid id PK
        uuid user_id FK
        varchar name
        uuid account_type_id FK
        varchar mask "last 4 digits"
        varchar color
        varchar source "email, manual, shortcut"
        numeric opening_balance
        boolean is_excluded
        boolean is_deleted
        timestamptz created_time
        timestamptz updated_time
    }

    m_account_type {
        uuid id PK
        uuid user_id FK
        varchar name
        boolean is_deleted
        timestamptz created_time
        timestamptz updated_time
    }

    m_asset {
        uuid id PK
        uuid user_id FK
        varchar name
        varchar kind "gold, investment, property, vehicle"
        numeric value
        boolean is_deleted
        timestamptz created_time
        timestamptz updated_time
    }

    m_category_group {
        uuid id PK
        uuid user_id FK
        varchar name
        varchar type "expense, income"
        boolean is_deleted
        timestamptz created_time
        timestamptz updated_time
    }

    m_category {
        uuid id PK
        uuid user_id FK
        uuid group_id FK
        varchar name
        varchar type "expense, income"
        varchar icon
        varchar color
        boolean is_deleted
        timestamptz created_time
        timestamptz updated_time
    }

    m_budget {
        uuid id PK
        uuid user_id FK
        uuid category_id FK
        uuid period_id FK
        uuid group_id FK
        numeric limit_amount
        timestamptz created_time
        timestamptz updated_time
    }

    m_ingest_token {
        uuid id PK
        uuid user_id FK
        varchar name
        varchar token_hash UK
        timestamptz last_used_time
        boolean is_revoked
        timestamptz created_time
    }

    t_ingest_event {
        uuid id PK
        uuid user_id FK
        varchar source "email, notification"
        varchar external_id
        varchar sender
        varchar subject
        text body
        timestamptz received_at
        varchar status
        varchar reason
        uuid transaction_id FK
        timestamptz created_time
        timestamptz updated_time
    }

    m_budget_period {
        uuid id PK
        uuid user_id FK
        varchar name
        varchar unit "day, week, month, year, once"
        integer interval_count
        date start_date
        date end_date "once only"
        boolean is_deleted
        timestamptz created_time
        timestamptz updated_time
    }

    m_budget_group {
        uuid id PK
        uuid user_id FK
        varchar name
        boolean is_deleted
        timestamptz created_time
        timestamptz updated_time
    }

    t_transaction {
        uuid id PK
        uuid user_id FK
        uuid account_id FK
        uuid to_account_id FK "transfers only"
        uuid category_id FK "null on transfers and until categorized"
        varchar type "expense, income, transfer"
        numeric amount "greater than 0"
        varchar name
        varchar detail
        timestamptz occurred_at
        varchar source "email, import, manual, shortcut"
        varchar status "review, verified"
        varchar reference "unique per user"
        boolean is_deleted
        timestamptz created_time
        timestamptz updated_time
    }
```

## Rules

- `amount`, `value`, `opening_balance`, and `limit_amount` use `numeric(18,2)`.
- Account balance is not stored. It is `opening_balance` plus income and incoming transfers, minus expenses and outgoing transfers, counting only transactions where `is_deleted` is false.
- A transfer is one row from `account_id` to `to_account_id`. The accounts must differ, it has no category, and it never counts as income, expense, or budget spending.
- Account types belong to one user and their names are unique per user. A type cannot be deleted while accounts still use it.
- Category groups belong to one user and have a type. Their names are unique per user and type. A group cannot be deleted while categories still use it.
- A category takes its `type` from its group, and can only move to a group of the same type. It cannot be deleted while a transaction or budget still uses it.
- A budget follows its period, and a category has at most one budget per period. Spending counts only expenses within the period's current dates.
- Budget periods and groups belong to one user, and their names are unique per user. Neither can be deleted while a budget uses it.
- A budget can only point to an `expense` category, and `t_transaction.type` must match its category's `type`. The services enforce both rules.
- A transaction takes its `type` from its category. Only imported transactions can have no category, and they start in `review`.
- Statement PDFs and their passwords are never stored.
- A device token is stored only as a SHA-256 hash, and can only send messages.
- An ingest event is unique per user, source, and message id, so a message sent twice is processed once. It keeps the message body so it can be read again after a parser or account is added.
- A message joins a transaction with the same account, direction, and amount within 10 minutes, unless another message already backs that transaction. Two or more candidates create a new transaction marked for checking.
- `occurred_at` keeps seconds for imported transactions, which is how a repeated import is recognized.
- `occurred_at` is sent and shown in Asia/Jakarta time.
- Deleting an account also soft-deletes its transactions, including transfers from or to it.
- Every table except `m_user` carries `user_id`. Queries must always filter by it.
- `is_deleted` keeps accounts, account types, assets, categories, category groups, budget periods, budget groups, and transactions recoverable. Budgets are deleted outright.
