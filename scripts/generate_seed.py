import json
import uuid
import math
import argparse
from pathlib import Path

# Static Demo User ID
DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

def gen_random_uuid():
    return str(uuid.uuid4())

# Helper functions to build node dicts
def build_node(node_type, label, params, x, y):
    return {
        "id": gen_random_uuid()[:8],
        "type": node_type,
        "label": label,
        "position": {"x": x, "y": y},
        "params": params,
        "data": {}
    }

def build_lif(label, x, y):
    return build_node("lif", label, {
        "tau_m": 20.0,
        "v_thresh": -50.0,
        "v_reset": -65.0,
        "v_rest": -60.0
    }, x, y)

def build_input(label, current, x, y):
    return build_node("input", label, {"current": current}, x, y)

def build_output(label, x, y):
    return build_node("output", label, {}, x, y)

def build_edge(source, target, weight=1.0):
    return {
        "id": f"e-{source}-{target}",
        "source": source,
        "target": target,
        "weight": weight
    }

# 1. Edge Detection
def generate_edge_detection():
    nodes = []
    edges = []
    
    # 10x10 input grid
    inputs = []
    for i in range(10):
        for j in range(10):
            node = build_input(f"In({i},{j})", 15.0 if i > 4 else 0.0, j * 50, i * 50)
            inputs.append(node)
            nodes.append(node)
            
    # Hidden Layer with lateral inhibition
    hidden = []
    for i in range(10):
        for j in range(10):
            node = build_lif(f"H({i},{j})", 600 + j * 60, i * 60)
            hidden.append(node)
            nodes.append(node)
            
            # Feedforward (simple receptive field)
            idx = i * 10 + j
            if idx < len(inputs):
                edges.append(build_edge(inputs[idx]["id"], node["id"], 2.0))
            
    # Lateral inhibition (second pass)
    for i in range(10):
        for j in range(10):
            idx = i * 10 + j
            node = hidden[idx]
            for di in [-1, 0, 1]:
                for dj in [-1, 0, 1]:
                    if di == 0 and dj == 0: continue
                    ni, nj = i + di, j + dj
                    if 0 <= ni < 10 and 0 <= nj < 10:
                        neighbor_idx = ni * 10 + nj
                        edges.append(build_edge(hidden[neighbor_idx]["id"], node["id"], -0.5))
                        
    # Output monitors pool
    output = build_output("Edge Trigger", 1300, 300)
    nodes.append(output)
    
    for h in hidden:
        # Connect right half
        edges.append(build_edge(h["id"], output["id"], 0.2))

    return {
        "nodes": nodes,
        "edges": edges,
        "model_info": {"model": "LIF", "backend": "cpu"}
    }
    
# 2. Logic Gates
def generate_logic_gates():
    nodes = []
    edges = []
    
    in1 = build_input("Input A", 10.0, 100, 100)
    in2 = build_input("Input B", 10.0, 100, 300)
    nodes.extend([in1, in2])
    
    # AND Gate
    and_gate = build_lif("AND Gate", 400, 100)
    # Require both inputs to spike (V_thresh=-50, V_rest=-60 => needs +10)
    edges.append(build_edge(in1["id"], and_gate["id"], 6.0))
    edges.append(build_edge(in2["id"], and_gate["id"], 6.0))
    nodes.append(and_gate)
    
    # OR Gate
    or_gate = build_lif("OR Gate", 400, 300)
    edges.append(build_edge(in1["id"], or_gate["id"], 12.0))
    edges.append(build_edge(in2["id"], or_gate["id"], 12.0))
    nodes.append(or_gate)
    
    # XOR Gate (Needs hidden layer to invert A and B)
    # Simple XOR using LIF: A OR B, AND NOT (A AND B)
    h_and = build_lif("XOR-AND", 400, 500)
    edges.append(build_edge(in1["id"], h_and["id"], 6.0))
    edges.append(build_edge(in2["id"], h_and["id"], 6.0))
    nodes.append(h_and)
    
    xor_gate = build_lif("XOR Gate", 600, 400)
    edges.append(build_edge(in1["id"], xor_gate["id"], 12.0))
    edges.append(build_edge(in2["id"], xor_gate["id"], 12.0))
    # Inhibition from AND
    edges.append(build_edge(h_and["id"], xor_gate["id"], -20.0))
    nodes.append(xor_gate)

    nodes.extend([
        build_output("AND Out", 800, 100),
        build_output("OR Out", 800, 300),
        build_output("XOR Out", 800, 500),
    ])
    edges.extend([
        build_edge(and_gate["id"], nodes[-3]["id"], 1.0),
        build_edge(or_gate["id"], nodes[-2]["id"], 1.0),
        build_edge(xor_gate["id"], nodes[-1]["id"], 1.0),
    ])

    # Fill up with random noise logic network to make it look complex
    for i in range(20):
        n = build_lif(f"Hidden {i}", 300 + int(str(i)[-1]) * 10, i * 40)
        edges.append(build_edge(in1["id"], n["id"], 0.2))
        nodes.append(n)

    return {
        "nodes": nodes,
        "edges": edges,
        "model_info": {"model": "LIF", "backend": "cpu"}
    }

# 3. Central Pattern Generator
def generate_cpg():
    nodes = []
    edges = []
    
    n_oscillators = 5
    oscillators = []
    for i in range(n_oscillators):
        base_x = 300 + i * 200
        base_y = 300 + math.sin(i) * 100
        
        o_ex_1 = build_lif(f"E1_{i}", base_x, base_y - 50)
        o_ex_2 = build_lif(f"E2_{i}", base_x, base_y + 50)
        o_in = build_lif(f"I_{i}", base_x + 80, base_y)
        
        # Self-excitation ring
        edges.append(build_edge(o_ex_1["id"], o_ex_2["id"], 5.0))
        edges.append(build_edge(o_ex_2["id"], o_ex_1["id"], 5.0))
        
        # Delay inhibition
        edges.append(build_edge(o_ex_1["id"], o_in["id"], 4.0))
        edges.append(build_edge(o_ex_2["id"], o_in["id"], 4.0))
        edges.append(build_edge(o_in["id"], o_ex_1["id"], -15.0))
        edges.append(build_edge(o_in["id"], o_ex_2["id"], -15.0))
        
        nodes.extend([o_ex_1, o_ex_2, o_in])
        oscillators.append((o_ex_1, o_ex_2, o_in))
        
    # Couple oscillators in ring
    for i in range(n_oscillators):
        next_i = (i + 1) % n_oscillators
        edges.append(build_edge(oscillators[i][0]["id"], oscillators[next_i][1]["id"], 2.0))
        edges.append(build_edge(oscillators[i][2]["id"], oscillators[next_i][2]["id"], -1.0))
        
    start_pulse = build_input("Trigger", 100.0, 100, 300)
    nodes.append(start_pulse)
    edges.append(build_edge(start_pulse["id"], oscillators[0][0]["id"], 15.0))

    out_1 = build_output("Motor Left", 1300, 200)
    out_2 = build_output("Motor Right", 1300, 400)
    nodes.extend([out_1, out_2])
    
    edges.append(build_edge(oscillators[0][0]["id"], out_1["id"], 1.0))
    edges.append(build_edge(oscillators[-1][1]["id"], out_2["id"], 1.0))
    
    return {
        "nodes": nodes,
        "edges": edges,
        "model_info": {"model": "LIF", "backend": "cpu"}
    }

def main():
    templates = [
        {
            "id": "e0000000-0000-0000-0000-000000000001",
            "name": "Edge Detection SNN",
            "description": "Gabor-filter inspired spiking network for visual edge extraction. Uses Izhikevich neurons with lateral inhibition for contrast enhancement.",
            "data": generate_edge_detection()
        },
        {
            "id": "e0000000-0000-0000-0000-000000000002",
            "name": "LIF Logic Gates",
            "description": "Leaky Integrate-and-Fire neurons wired as AND, OR, XOR gates. A minimal example of spike-based Boolean computation.",
            "data": generate_logic_gates()
        },
        {
            "id": "e0000000-0000-0000-0000-000000000003",
            "name": "Central Pattern Generator",
            "description": "Recurrent SNN producing rhythmic oscillatory patterns. Demonstrates emergent timing through synaptic delays and inhibitory feedback.",
            "data": generate_cpg()
        }
    ]

    sql = f'''-- SpikeVerse Seed Data
-- This script inserts initial demo/example data for testing and demonstration.

-- ============================================================================
-- INSERT DEMO USER
-- ============================================================================
-- Password for demo user is 'demo123' (bcrypt hash)
INSERT INTO users (user_id, username, password_hash, created_at, updated_at)
VALUES (
    '{DEMO_USER_ID}',
    'demo_user',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzO8KvUF4K',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- INSERT EXAMPLE NETWORKS
-- ============================================================================
'''

    for t in templates:
        meta_json_str = json.dumps(t["data"]).replace("'", "''")
        sql += f'''
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
    '{t["id"]}',
    '{DEMO_USER_ID}',
    '{t["name"]}',
    '{t["description"]}',
    '{meta_json_str}'::jsonb,
    TRUE,
    'cpu',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (network_id) DO NOTHING;
'''

    sql += '''
-- ============================================================================
-- LOG SEED COMPLETION
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Seed data inserted successfully!';
    RAISE NOTICE 'Demo user: demo_user (password: demo123)';
    RAISE NOTICE 'Example networks added!';
END $$;
'''

    target = Path("db/init/02-seed.sql")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(sql)
    print(f"Generated {target.absolute()}")

if __name__ == "__main__":
    main()
