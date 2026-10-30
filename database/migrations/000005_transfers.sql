-- A transfer is one row that moves money from account_id to to_account_id.

ALTER TABLE t_transaction ADD COLUMN to_account_id uuid REFERENCES m_account (id);

ALTER TABLE t_transaction DROP CONSTRAINT t_transaction_type_check;
ALTER TABLE t_transaction ADD CONSTRAINT t_transaction_type_check
    CHECK (type IN ('expense', 'income', 'transfer'));

ALTER TABLE t_transaction ADD CONSTRAINT t_transaction_transfer_check
    CHECK (
        (type = 'transfer') = (to_account_id IS NOT NULL)
        AND (to_account_id IS NULL OR (to_account_id <> account_id AND category_id IS NULL))
    );

CREATE INDEX t_transaction_to_account_idx ON t_transaction (to_account_id) WHERE NOT is_deleted;
