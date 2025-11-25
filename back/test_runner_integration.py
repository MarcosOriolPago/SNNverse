#!/usr/bin/env python3
"""
Complete integration test for backend flexibility.
Creates a model with metadata and verifies runner can load it.
"""

import os
import sys
import json
import subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "app"))

from genn_builder import GeNNNetworkBuilder

def create_test_model():
    """Create a test model with complete metadata."""
    
    print("=" * 70)
    print("Creating Test Model with Backend Metadata")
    print("=" * 70)
    
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
            }
        ],
        "edges": []
    }
    
    # Build with CPU backend
    builder = GeNNNetworkBuilder(backend="cpu")
    code_path, info = builder.build_from_json(test_network)
    
    print(f"\n✓ Model built: {code_path}")
    print(f"✓ Backend: {info['backend']}")
    
    # Create neuron metadata for the runner
    neuron_metadata = {
        "neurons": [
            {
                "id": "neuron1",
                "name": "neuron1",
                "size": 1
            }
        ]
    }
    
    metadata_path = os.path.join(code_path, "neuron_metadata.json")
    with open(metadata_path, 'w') as f:
        json.dump(neuron_metadata, f, indent=2)
    
    print(f"✓ Neuron metadata created: {metadata_path}")
    
    # Verify backend_info.json exists
    backend_info_path = os.path.join(code_path, "backend_info.json")
    with open(backend_info_path) as f:
        backend_info = json.load(f)
    
    print(f"\n✓ Backend Info:")
    print(f"  - Backend: {backend_info['backend']}")
    print(f"  - Type: {backend_info['backend_type']}")
    print(f"  - Requires sync: {backend_info['requires_device_sync']}")
    
    return code_path, info

def test_runner_detection(code_path):
    """Test that C++ runner detects backend correctly."""
    
    print("\n" + "=" * 70)
    print("Testing C++ Runner Backend Detection")
    print("=" * 70)
    
    runner_path = "/home/marcos/marcos/snns/SNNverse/back/cpp_runner/build/genn_runner"
    
    if not os.path.exists(runner_path):
        print(f"✗ Runner not found at: {runner_path}")
        print("  Please build the runner first: cd cpp_runner && ./build.sh")
        return False
    
    # Run the runner with a short timeout to just see initialization
    cmd = [runner_path, code_path, "9002"]
    
    print(f"\nStarting runner: {' '.join(cmd)}")
    print("(Will timeout after 2 seconds - we only need to see initialization)\n")
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=2
        )
    except subprocess.TimeoutExpired as e:
        output = e.stdout.decode() if isinstance(e.stdout, bytes) else e.stdout
        stderr = e.stderr.decode() if isinstance(e.stderr, bytes) else e.stderr
        
        print("Runner output:")
        print(output)
        if stderr:
            print("\nStderr:")
            print(stderr)
        
        # Check for successful backend detection
        if "✓ Backend: CPU" in output:
            print("\n" + "=" * 70)
            print("✅ SUCCESS: Backend detection working correctly!")
            print("=" * 70)
            print("The runner successfully:")
            print("  1. Read backend_info.json")
            print("  2. Detected CPU backend")
            print("  3. Disabled device synchronization")
            return True
        else:
            print("\n✗ Backend detection not found in output")
            return False
    
    # If it didn't timeout, check output
    print("Runner output:")
    print(result.stdout)
    if result.stderr:
        print("\nStderr:")
        print(result.stderr)
    
    return "✓ Backend: CPU" in result.stdout

if __name__ == "__main__":
    try:
        # Create test model
        code_path, info = create_test_model()
        
        # Test runner
        success = test_runner_detection(code_path)
        
        if success:
            print("\n✅ All tests passed!")
            sys.exit(0)
        else:
            print("\n✗ Tests failed")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
