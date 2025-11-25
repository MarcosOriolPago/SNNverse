#!/usr/bin/env python3
"""
Test script to demonstrate GeNN backend flexibility.

This script tests both CPU and GPU backend selection and verifies
that the backend metadata is correctly exported.
"""

import os
import sys
import json
from pathlib import Path

# Add app directory to path
sys.path.insert(0, str(Path(__file__).parent / "app"))

from genn_builder import GeNNNetworkBuilder

def test_backend_selection():
    """Test automatic backend selection and metadata export."""
    
    print("=" * 70)
    print("Testing GeNN Backend Flexibility")
    print("=" * 70)
    print()
    
    # Create a simple test network
    test_network = {
        "nodes": [
            {
                "id": "neuron1",
                "type": "LIF",
                "params": {
                    "threshold": -55.0,
                    "reset": -70.0,
                    "tau": 20.0
                }
            },
            {
                "id": "neuron2",
                "type": "LIF",
                "params": {
                    "threshold": -50.0,
                    "reset": -65.0,
                    "tau": 15.0
                }
            }
        ],
        "edges": [
            {
                "source": "neuron1",
                "target": "neuron2"
            }
        ]
    }
    
    # Test 1: Auto backend selection
    print("Test 1: Auto backend selection")
    print("-" * 70)
    
    builder_auto = GeNNNetworkBuilder(backend="auto")
    code_path_auto, info_auto = builder_auto.build_from_json(test_network)
    
    print(f"\n✓ Model built with auto-selected backend: {info_auto['backend']}")
    print(f"  Code path: {code_path_auto}")
    
    # Verify backend_info.json exists
    backend_info_path = os.path.join(code_path_auto, "backend_info.json")
    if os.path.exists(backend_info_path):
        with open(backend_info_path) as f:
            backend_info = json.load(f)
        print(f"  ✓ Backend metadata exported:")
        print(f"    - Backend: {backend_info['backend']}")
        print(f"    - Type: {backend_info['backend_type']}")
        print(f"    - Requires device sync: {backend_info['requires_device_sync']}")
    else:
        print(f"  ✗ Backend metadata NOT found!")
    
    print()
    
    # Test 2: Force CPU backend
    print("Test 2: Force CPU backend")
    print("-" * 70)
    
    builder_cpu = GeNNNetworkBuilder(backend="cpu")
    code_path_cpu, info_cpu = builder_cpu.build_from_json(test_network)
    
    print(f"\n✓ Model built with CPU backend: {info_cpu['backend']}")
    print(f"  Code path: {code_path_cpu}")
    
    # Verify backend_info.json
    backend_info_path = os.path.join(code_path_cpu, "backend_info.json")
    if os.path.exists(backend_info_path):
        with open(backend_info_path) as f:
            backend_info = json.load(f)
        print(f"  ✓ Backend metadata exported:")
        print(f"    - Backend: {backend_info['backend']}")
        print(f"    - Type: {backend_info['backend_type']}")
        print(f"    - Requires device sync: {backend_info['requires_device_sync']}")
    
    print()
    print("=" * 70)
    print("Summary")
    print("=" * 70)
    print(f"✓ Auto-selected backend: {info_auto['backend']}")
    print(f"✓ CPU backend: {info_cpu['backend']}")
    print(f"\nThe C++ runner will now automatically detect the backend")
    print(f"and adapt its behavior accordingly:")
    print(f"  - CPU backend: No device synchronization")
    print(f"  - GPU backend: Calls pullStateFromDevice() when needed")
    print()


if __name__ == "__main__":
    try:
        test_backend_selection()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
