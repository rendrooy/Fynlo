-- Remembers transactions the user checked and decided aren't duplicates.

ALTER TABLE t_transaction ADD COLUMN is_not_duplicate boolean NOT NULL DEFAULT false;
