-- Replaces the fixed account kinds with types each user can manage.

CREATE TABLE m_account_type (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES m_user (id),
    name varchar(50) NOT NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    created_time timestamptz NOT NULL DEFAULT now(),
    updated_time timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX m_account_type_name_uq ON m_account_type (user_id, lower(name)) WHERE NOT is_deleted;

INSERT INTO m_account_type (user_id, name)
SELECT u.id, t.name
FROM m_user u
CROSS JOIN (VALUES ('Bank account'), ('Cash'), ('E-wallet')) AS t (name);

ALTER TABLE m_account ADD COLUMN account_type_id uuid REFERENCES m_account_type (id);

UPDATE m_account a
SET account_type_id = t.id
FROM m_account_type t
WHERE t.user_id = a.user_id
  AND t.name = CASE a.kind
    WHEN 'bank' THEN 'Bank account'
    WHEN 'cash' THEN 'Cash'
    WHEN 'ewallet' THEN 'E-wallet'
  END;

ALTER TABLE m_account ALTER COLUMN account_type_id SET NOT NULL;
ALTER TABLE m_account DROP COLUMN kind;

CREATE INDEX m_account_type_idx ON m_account (account_type_id) WHERE NOT is_deleted;
