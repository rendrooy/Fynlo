-- Lets each user define budget periods and groups, and a category have one budget per period.

CREATE TABLE m_budget_period (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES m_user (id),
    name varchar(50) NOT NULL,
    unit varchar(10) NOT NULL CHECK (unit IN ('day', 'month', 'once', 'week', 'year')),
    interval_count integer NOT NULL DEFAULT 1 CHECK (interval_count BETWEEN 1 AND 365),
    start_date date NOT NULL,
    end_date date,
    is_deleted boolean NOT NULL DEFAULT false,
    created_time timestamptz NOT NULL DEFAULT now(),
    updated_time timestamptz NOT NULL DEFAULT now(),
    CHECK ((unit = 'once') = (end_date IS NOT NULL)),
    CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE UNIQUE INDEX m_budget_period_name_uq ON m_budget_period (user_id, lower(name)) WHERE NOT is_deleted;

CREATE TABLE m_budget_group (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES m_user (id),
    name varchar(50) NOT NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    created_time timestamptz NOT NULL DEFAULT now(),
    updated_time timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX m_budget_group_name_uq ON m_budget_group (user_id, lower(name)) WHERE NOT is_deleted;

-- 3 January 2000 is a Monday, so the default week runs Monday to Sunday.
INSERT INTO m_budget_period (user_id, name, unit, start_date)
SELECT u.id, p.name, p.unit, p.start_date::date
FROM m_user u
CROSS JOIN (VALUES
    ('Weekly', 'week', '2000-01-03'),
    ('Monthly', 'month', '2000-01-01'),
    ('Yearly', 'year', '2000-01-01')
) AS p (name, unit, start_date);

INSERT INTO m_budget_group (user_id, name)
SELECT u.id, g.name
FROM m_user u
CROSS JOIN (VALUES ('Needs'), ('Wants'), ('Savings')) AS g (name);

ALTER TABLE m_budget ADD COLUMN period_id uuid REFERENCES m_budget_period (id);
ALTER TABLE m_budget ADD COLUMN group_id uuid REFERENCES m_budget_group (id);

-- Budgets so far repeat every month, which is exactly the default Monthly period.
UPDATE m_budget b
SET period_id = p.id, group_id = g.id
FROM m_budget_period p, m_budget_group g
WHERE p.user_id = b.user_id AND p.name = 'Monthly'
  AND g.user_id = b.user_id AND g.name = 'Needs';

ALTER TABLE m_budget ALTER COLUMN period_id SET NOT NULL;
ALTER TABLE m_budget ALTER COLUMN group_id SET NOT NULL;

ALTER TABLE m_budget DROP CONSTRAINT m_budget_category_id_key;
ALTER TABLE m_budget ADD CONSTRAINT m_budget_category_period_key UNIQUE (category_id, period_id);

CREATE INDEX m_budget_period_idx ON m_budget (period_id);
CREATE INDEX m_budget_group_idx ON m_budget (group_id);
