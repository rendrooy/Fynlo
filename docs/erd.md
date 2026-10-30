# Fynlo ERD

```mermaid
erDiagram
    m_user ||--o{ m_account : owns
    m_user ||--o{ m_account_type : defines
    m_account_type ||--o{ m_account : groups
    m_user ||--o{ m_asset : owns
    m_user ||--o{ m_category : owns
    m_user ||--o{ m_budget : sets
    m_user ||--o{ t_transaction : records
    m_account ||--o{ t_transaction : "holds"
    m_category ||--o{ t_transaction : "classifies"
    m_category ||--o| m_budget : "is limited by"

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

    m_category {
        uuid id PK
        uuid user_id FK
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
        uuid category_id FK,UK
        numeric limit_amount
        timestamptz created_time
        timestamptz updated_time
    }

    t_transaction {
        uuid id PK
        uuid user_id FK
        uuid account_id FK
        uuid category_id FK
        varchar type "expense, income"
        numeric amount "greater than 0"
        varchar name
        varchar detail
        timestamptz occurred_at
        varchar source "email, manual, shortcut"
        varchar status "review, verified"
        boolean is_deleted
        timestamptz created_time
        timestamptz updated_time
    }
```

## Rules

- `amount`, `value`, `opening_balance`, and `limit_amount` use `numeric(18,2)`.
- Account balance is not stored. It is `opening_balance` plus income minus expenses, counting only transactions where `is_deleted` is false.
- Account types belong to one user and their names are unique per user. A type cannot be deleted while accounts still use it.
- A budget repeats every month, and each category has at most one.
- A budget can only point to an `expense` category, and `t_transaction.type` must match its category's `type`. The services enforce both rules.
- Every table except `m_user` carries `user_id`. Queries must always filter by it.
- `is_deleted` keeps accounts, account types, assets, categories, and transactions recoverable. Budgets are deleted outright.
