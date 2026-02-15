-- SNNverse Database Schema Initialization
-- This script creates the database schema for user authentication,
-- network storage, and simulation statistics tracking.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

COMMENT ON TABLE users IS 'User accounts and authentication';
COMMENT ON COLUMN users.user_id IS 'Unique user identifier (UUID)';
COMMENT ON COLUMN users.username IS 'Unique username for login';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password';

-- ============================================================================
-- NETWORKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS networks (
    network_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metadata_json JSONB NOT NULL,
    compiled_code_url VARCHAR(512),
    model_sha VARCHAR(64),
    is_example BOOLEAN NOT NULL DEFAULT FALSE,
    backend_used VARCHAR(50) NOT NULL DEFAULT 'cpu',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_compiled_at TIMESTAMP,
    
    CONSTRAINT fk_networks_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

-- Indexes for networks table
CREATE INDEX IF NOT EXISTS idx_networks_network_id ON networks(network_id);
CREATE INDEX IF NOT EXISTS idx_networks_user_id ON networks(user_id);
CREATE INDEX IF NOT EXISTS idx_networks_created_at ON networks(created_at);
CREATE INDEX IF NOT EXISTS idx_networks_model_sha ON networks(model_sha);
CREATE INDEX IF NOT EXISTS idx_networks_user_name ON networks(user_id, name);

COMMENT ON TABLE networks IS 'Network definitions and compiled model artifacts';
COMMENT ON COLUMN networks.network_id IS 'Unique network identifier (UUID)';
COMMENT ON COLUMN networks.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN networks.name IS 'Human-readable network name';
COMMENT ON COLUMN networks.metadata_json IS 'Stores node/edge config from frontend (JSONB)';
COMMENT ON COLUMN networks.compiled_code_url IS 'S3/MinIO path to compiled .zip';
COMMENT ON COLUMN networks.model_sha IS 'GeNN model checksum (SHA256) for warm-start';
COMMENT ON COLUMN networks.backend_used IS 'Backend used: cpu, cuda, single_threaded_cpu';

-- ============================================================================
-- SIMULATION_STATS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS simulation_stats (
    stat_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    network_id UUID NOT NULL,
    duration_ms FLOAT NOT NULL,
    spike_count INTEGER,
    backend_used VARCHAR(50) NOT NULL,
    num_timesteps INTEGER,
    wall_time_ms FLOAT,
    memory_peak_mb FLOAT,
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    error_message TEXT,
    used_precompiled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_simulation_stats_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_simulation_stats_network
        FOREIGN KEY (network_id)
        REFERENCES networks(network_id)
        ON DELETE CASCADE
);

-- Indexes for simulation_stats table
CREATE INDEX IF NOT EXISTS idx_simulation_stats_stat_id ON simulation_stats(stat_id);
CREATE INDEX IF NOT EXISTS idx_simulation_stats_user_id ON simulation_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_simulation_stats_network_id ON simulation_stats(network_id);
CREATE INDEX IF NOT EXISTS idx_simulation_stats_created_at ON simulation_stats(created_at);
CREATE INDEX IF NOT EXISTS idx_simulation_stats_user_created ON simulation_stats(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_simulation_stats_network_created ON simulation_stats(network_id, created_at);

COMMENT ON TABLE simulation_stats IS 'Execution metrics and performance statistics';
COMMENT ON COLUMN simulation_stats.stat_id IS 'Unique statistic identifier (UUID)';
COMMENT ON COLUMN simulation_stats.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN simulation_stats.network_id IS 'Foreign key to networks table';
COMMENT ON COLUMN simulation_stats.duration_ms IS 'Total simulation time in milliseconds';
COMMENT ON COLUMN simulation_stats.spike_count IS 'Total number of spikes across all neurons';
COMMENT ON COLUMN simulation_stats.backend_used IS 'CPU, CUDA, etc.';
COMMENT ON COLUMN simulation_stats.num_timesteps IS 'Number of timesteps executed';
COMMENT ON COLUMN simulation_stats.wall_time_ms IS 'Actual computation time';
COMMENT ON COLUMN simulation_stats.memory_peak_mb IS 'Peak memory usage';
COMMENT ON COLUMN simulation_stats.status IS 'Execution status: completed, failed, timeout';
COMMENT ON COLUMN simulation_stats.used_precompiled IS 'Whether warm-start was used';

-- ============================================================================
-- TRIGGERS FOR AUTO-UPDATE OF updated_at
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for networks table
CREATE TRIGGER update_networks_updated_at
    BEFORE UPDATE ON networks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIALIZATION COMPLETE
-- ============================================================================

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'SNNverse database schema initialized successfully!';
    RAISE NOTICE 'Tables created: users, networks, simulation_stats';
    RAISE NOTICE 'Indexes and foreign keys configured';
END $$;
