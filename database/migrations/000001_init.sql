-- Tables are unqualified: the migration runner sets search_path to DB_SCHEMA.

CREATE TABLE m_user (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(255) NOT NULL UNIQUE,
    password_hash varchar(255) NOT NULL,
    name varchar(100) NOT NULL,
    initials varchar(4) NOT NULL,
    created_time timestamptz NOT NULL DEFAULT now(),
    updated_time timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE m_account (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES m_user (id),
    name varchar(100) NOT NULL,
    kind varchar(20) NOT NULL CHECK (kind IN ('bank', 'cash', 'ewallet')),
    mask varchar(4),
    color varchar(7) NOT NULL,
    source varchar(20) NOT NULL CHECK (source IN ('email', 'manual', 'shortcut')),
    opening_balance numeric(18,2) NOT NULL DEFAULT 0,
    is_excluded boolean NOT NULL DEFAULT false,
    is_deleted boolean NOT NULL DEFAULT false,
    created_time timestamptz NOT NULL DEFAULT now(),
    updated_time timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX m_account_user_idx ON m_account (user_id) WHERE NOT is_deleted;

CREATE TABLE m_asset (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES m_user (id),
    name varchar(100) NOT NULL,
    kind varchar(20) NOT NULL CHECK (kind IN ('gold', 'investment', 'property', 'vehicle')),
    value numeric(18,2) NOT NULL CHECK (value >= 0),
    is_deleted boolean NOT NULL DEFAULT false,
    created_time timestamptz NOT NULL DEFAULT now(),
    updated_time timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX m_asset_user_idx ON m_asset (user_id) WHERE NOT is_deleted;

CREATE TABLE m_category (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES m_user (id),
    name varchar(100) NOT NULL,
    type varchar(10) NOT NULL CHECK (type IN ('expense', 'income')),
    icon varchar(30) NOT NULL,
    color varchar(7) NOT NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    created_time timestamptz NOT NULL DEFAULT now(),
    updated_time timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX m_category_name_uq ON m_category (user_id, type, lower(name)) WHERE NOT is_deleted;

CREATE TABLE m_budget (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES m_user (id),
    category_id uuid NOT NULL UNIQUE REFERENCES m_category (id),
    limit_amount numeric(18,2) NOT NULL CHECK (limit_amount > 0),
    created_time timestamptz NOT NULL DEFAULT now(),
    updated_time timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX m_budget_user_idx ON m_budget (user_id);

CREATE TABLE t_transaction (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES m_user (id),
    account_id uuid NOT NULL REFERENCES m_account (id),
    category_id uuid NOT NULL REFERENCES m_category (id),
    type varchar(10) NOT NULL CHECK (type IN ('expense', 'income')),
    amount numeric(18,2) NOT NULL CHECK (amount > 0),
    name varchar(100) NOT NULL,
    detail varchar(255),
    occurred_at timestamptz NOT NULL,
    source varchar(20) NOT NULL CHECK (source IN ('email', 'manual', 'shortcut')),
    status varchar(10) NOT NULL DEFAULT 'verified' CHECK (status IN ('review', 'verified')),
    is_deleted boolean NOT NULL DEFAULT false,
    created_time timestamptz NOT NULL DEFAULT now(),
    updated_time timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX t_transaction_user_time_idx ON t_transaction (user_id, occurred_at DESC) WHERE NOT is_deleted;
CREATE INDEX t_transaction_account_idx ON t_transaction (account_id) WHERE NOT is_deleted;
CREATE INDEX t_transaction_category_idx ON t_transaction (category_id) WHERE NOT is_deleted;
