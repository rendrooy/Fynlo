-- Puts every category in a group each user can manage, and gives users their starter categories.

CREATE TABLE m_category_group (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES m_user (id),
    name varchar(50) NOT NULL,
    type varchar(10) NOT NULL CHECK (type IN ('expense', 'income')),
    is_deleted boolean NOT NULL DEFAULT false,
    created_time timestamptz NOT NULL DEFAULT now(),
    updated_time timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX m_category_group_name_uq ON m_category_group (user_id, type, lower(name)) WHERE NOT is_deleted;

INSERT INTO m_category_group (user_id, name, type)
SELECT u.id, g.name, g.type
FROM m_user u
CROSS JOIN (VALUES ('Needs', 'expense'), ('Lifestyle', 'expense'), ('Income', 'income')) AS g (name, type);

ALTER TABLE m_category ADD COLUMN group_id uuid REFERENCES m_category_group (id);

UPDATE m_category c
SET group_id = g.id
FROM m_category_group g
WHERE g.user_id = c.user_id
  AND g.type = c.type
  AND g.name = CASE c.type WHEN 'expense' THEN 'Needs' ELSE 'Income' END;

INSERT INTO m_category (user_id, group_id, name, type, icon, color)
SELECT g.user_id, g.id, d.name, g.type, d.icon, d.color
FROM m_category_group g
JOIN (VALUES
    ('Needs', 'Bills', 'receipt', '#f59e0b'),
    ('Needs', 'Food & Drinks', 'utensils', '#059669'),
    ('Needs', 'Housing', 'home', '#e11d48'),
    ('Needs', 'Transport', 'car', '#0ea5e9'),
    ('Lifestyle', 'Entertainment', 'film', '#64748b'),
    ('Lifestyle', 'Shopping', 'bag', '#8b5cf6'),
    ('Income', 'Freelance', 'laptop', '#0ea5e9'),
    ('Income', 'Salary', 'wallet', '#059669')
) AS d (group_name, name, icon, color) ON d.group_name = g.name
WHERE NOT EXISTS (
    SELECT 1 FROM m_category c
    WHERE c.user_id = g.user_id
      AND c.type = g.type
      AND lower(c.name) = lower(d.name)
      AND NOT c.is_deleted
);

ALTER TABLE m_category ALTER COLUMN group_id SET NOT NULL;

CREATE INDEX m_category_group_idx ON m_category (group_id) WHERE NOT is_deleted;
