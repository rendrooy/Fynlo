-- Lets a device send bank messages to Fynlo, keeping each message as evidence for its transaction.

CREATE TABLE m_ingest_token (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES m_user (id),
    name varchar(50) NOT NULL,
    token_hash varchar(64) NOT NULL UNIQUE,
    last_used_time timestamptz,
    is_revoked boolean NOT NULL DEFAULT false,
    created_time timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX m_ingest_token_user_idx ON m_ingest_token (user_id) WHERE NOT is_revoked;

ALTER TABLE t_transaction ADD COLUMN reference varchar(64);

CREATE UNIQUE INDEX t_transaction_reference_uq ON t_transaction (user_id, reference)
    WHERE reference IS NOT NULL AND NOT is_deleted;

CREATE TABLE t_ingest_event (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES m_user (id),
    source varchar(20) NOT NULL CHECK (source IN ('email', 'notification')),
    external_id varchar(255) NOT NULL,
    sender varchar(255),
    subject varchar(255),
    body text NOT NULL,
    received_at timestamptz NOT NULL,
    status varchar(20) NOT NULL CHECK (status IN ('ambiguous', 'created', 'failed', 'ignored', 'merged', 'unmatched')),
    reason varchar(255),
    transaction_id uuid REFERENCES t_transaction (id),
    created_time timestamptz NOT NULL DEFAULT now(),
    updated_time timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, source, external_id)
);

CREATE INDEX t_ingest_event_user_time_idx ON t_ingest_event (user_id, received_at DESC);
CREATE INDEX t_ingest_event_transaction_idx ON t_ingest_event (transaction_id);
