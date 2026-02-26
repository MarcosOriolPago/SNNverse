-- SNNverse: Guest Users & Google OAuth Migration
-- Adds support for guest sessions, Google OAuth, and user profiles.

-- Add new columns to users table
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
    ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Make password_hash nullable (guests and Google-only users won't have one)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Index for Google OAuth lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Comments
COMMENT ON COLUMN users.is_guest IS 'True for auto-created guest sessions';
COMMENT ON COLUMN users.email IS 'Email from Google OAuth or manual registration';
COMMENT ON COLUMN users.google_id IS 'Google OAuth sub claim for fast lookups';
COMMENT ON COLUMN users.display_name IS 'Human-readable name (Google name or username)';
COMMENT ON COLUMN users.avatar_url IS 'Profile picture URL (Google avatar or null)';

DO $$
BEGIN
    RAISE NOTICE 'Guest & OAuth migration applied successfully.';
END $$;
