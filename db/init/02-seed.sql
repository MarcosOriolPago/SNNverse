-- SNNverse Seed Data
-- This script inserts initial demo/example data for testing and demonstration.

-- ============================================================================
-- INSERT DEMO USER
-- ============================================================================
-- Password for demo user is 'demo123' (bcrypt hash)
INSERT INTO users (user_id, username, password_hash, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'demo_user',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzO8KvUF4K',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- INSERT EXAMPLE NETWORK
-- ============================================================================
INSERT INTO networks (
    network_id,
    user_id,
    name,
    description,
    metadata_json,
    is_example,
    backend_used,
    created_at,
    updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'Simple Leaky Integrate-and-Fire',
    'A basic LIF neuron network demonstrating spike generation with constant input current',
    '{
        "nodes": [
            {
                "id": "input_1",
                "type": "input",
                "label": "Input Neuron",
                "params": {
                    "current": 10.0
                }
            },
            {
                "id": "lif_1",
                "type": "lif",
                "label": "LIF Neuron",
                "params": {
                    "tau_m": 20.0,
                    "v_thresh": -50.0,
                    "v_reset": -70.0,
                    "v_rest": -65.0
                }
            },
            {
                "id": "output_1",
                "type": "output",
                "label": "Output Monitor"
            }
        ],
        "edges": [
            {
                "source": "input_1",
                "target": "lif_1",
                "weight": 0.5
            },
            {
                "source": "lif_1",
                "target": "output_1",
                "weight": 1.0
            }
        ]
    }'::jsonb,
    TRUE,
    'cpu',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (network_id) DO NOTHING;

-- ============================================================================
-- LOG SEED COMPLETION
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Seed data inserted successfully!';
    RAISE NOTICE 'Demo user: demo_user (password: demo123)';
    RAISE NOTICE 'Example network: Simple Leaky Integrate-and-Fire';
END $$;
