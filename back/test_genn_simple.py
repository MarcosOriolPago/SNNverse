#!/usr/bin/env python3
"""
Simple test to verify GeNN integration works.
Run this with: .venv/bin/python test_genn_simple.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.genn_builder import GeNNNetworkBuilder

print("=" * 70)
print("GeNN Integration Test - Simple Network")
print("=" * 70)

# Define a simple 2-neuron network
test_payload = {
    "nodes": [
        {
            "id": "neuron1", 
            "type": "LIF", 
            "params": {
                "threshold": -55.0,
                "tau": 20.0,
                "rest": -70.0,
                "reset": -70.0
            }
        },
        {
            "id": "neuron2", 
            "type": "LIF", 
            "params": {
                "threshold": -50.0,
                "tau": 15.0
            }
        }
    ],
    "edges": [
        {"source": "neuron1", "target": "neuron2"}
    ]
}

print("\n1. Creating GeNN builder...")
builder = GeNNNetworkBuilder()
print("   ✓ Builder created")

print("\n2. Building model from JSON...")
code_path, model_info = builder.build_from_json(test_payload)
print("   ✓ Model built")

print("\n3. Model Information:")
for key, value in model_info.items():
    print(f"   {key:15s}: {value}")

print("\n4. Generated files:")
import glob
generated_files = glob.glob(f"{code_path}/*")
for f in sorted(generated_files)[:10]:  # Show first 10 files
    print(f"   - {os.path.basename(f)}")
if len(generated_files) > 10:
    print(f"   ... and {len(generated_files) - 10} more files")

print("\n5. Loading model into memory...")
builder.load_model()
print("   ✓ Model loaded")

print("\n6. Getting neuron populations...")
pops = builder.get_neuron_populations()
print(f"   Found {len(pops)} populations:")
for pop_id, pop in pops.items():
    print(f"   - {pop_id}: {pop.num_neurons} neuron(s)")

print("\n" + "=" * 70)
print("SUCCESS! GeNN integration is working correctly.")
print("=" * 70)
print(f"\nGenerated code location: {code_path}")
print("\nNext steps:")
print("  1. Test simulation: .venv/bin/python test_genn_simulator.py")
print("  2. Start server: .venv/bin/python -m app.main_genn")
print("=" * 70)
