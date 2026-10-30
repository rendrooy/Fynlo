-- Statement rows have no category until the user picks one, and need their own source.

ALTER TABLE t_transaction ALTER COLUMN category_id DROP NOT NULL;

ALTER TABLE t_transaction DROP CONSTRAINT t_transaction_source_check;
ALTER TABLE t_transaction ADD CONSTRAINT t_transaction_source_check
    CHECK (source IN ('email', 'import', 'manual', 'shortcut'));
