-- SpikeVerse: User roles + default admin
-- Adds role support and guarantees the default admin account exists.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Ensure admin account exists for template management.
-- Password is bcrypt-hashed by PostgreSQL via pgcrypto.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO users (
    username,
    password_hash,
    is_guest,
    role,
    display_name,
    created_at,
    updated_at
)
VALUES (
    'moriol',
    crypt('trebol', gen_salt('bf')),
    FALSE,
    'admin',
    'moriol',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (username) DO UPDATE
SET
    password_hash = EXCLUDED.password_hash,
    is_guest = FALSE,
    role = 'admin',
    display_name = COALESCE(users.display_name, EXCLUDED.display_name),
    updated_at = CURRENT_TIMESTAMP;

DO $$
BEGIN
    RAISE NOTICE 'Roles migration applied. Admin user: moriol';
END $$;
