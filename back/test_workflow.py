#!/usr/bin/env python3
"""
Test script to verify the custom spike function workflow
"""

from app.sandbox import execute_spike_function, test_function_quick

print("=" * 60)
print("Testing Custom Spike Function Workflow")
print("=" * 60)

# Test 1: Simple spike function
print("\n[Test 1] Simple always-spike function:")
code1 = """
def spike_function(t, ctx):
    return True
"""
success, result, error = execute_spike_function(code1, 0.0, {})
print(f"  ✓ Success: {success}, Spike: {result}")

# Test 2: Time-based spiking
print("\n[Test 2] Time-based periodic spiking:")
code2 = """
def spike_function(t, ctx):
    # Spike every 1 second
    return int(t) % 2 == 0
"""
for t in [0.0, 0.5, 1.0, 1.5, 2.0]:
    success, result, error = execute_spike_function(code2, t, {})
    status = "SPIKE" if result else "no spike"
    print(f"  t={t}: {status}")

# Test 3: Random spiking with probability
print("\n[Test 3] Random spiking (30% probability):")
code3 = """
def spike_function(t, ctx):
    import random
    return random.random() < 0.3
"""
spike_count = 0
trials = 100
for i in range(trials):
    success, result, error = execute_spike_function(code3, float(i) * 0.1, {})
    if result:
        spike_count += 1
print(f"  Spiked {spike_count}/{trials} times (~{spike_count}% spike rate)")

# Test 4: Using math module
print("\n[Test 4] Sine wave based spiking:")
code4 = """
def spike_function(t, ctx):
    import math
    # Spike when sin(t) > 0.5
    return math.sin(t) > 0.5
"""
for t in [0.0, 0.5, 1.0, 1.5, 2.0]:
    success, result, error = execute_spike_function(code4, t, {})
    status = "SPIKE" if result else "no spike"
    print(f"  t={t}: {status}")

# Test 5: Context usage
print("\n[Test 5] Using context information:")
code5 = """
def spike_function(t, ctx):
    node_id = ctx.get('node_id', 'unknown')
    # Spike if node_id is provided
    return node_id != 'unknown'
"""
success, result, error = execute_spike_function(code5, 0.0, {'node_id': 'input_1'})
print(f"  With node_id: {result}")
success, result, error = execute_spike_function(code5, 0.0, {})
print(f"  Without node_id: {result}")

# Test 6: Error handling - invalid return type
print("\n[Test 6] Error handling (invalid return type):")
code6 = """
def spike_function(t, ctx):
    return "not a boolean"
"""
success, result, error = execute_spike_function(code6, 0.0, {})
print(f"  Success: {success}")
print(f"  Error: {error}")

# Test 7: Error handling - forbidden import
print("\n[Test 7] Security (forbidden import):")
code7 = """
def spike_function(t, ctx):
    import os
    return True
"""
success, result, error = execute_spike_function(code7, 0.0, {})
print(f"  Success: {success}")
print(f"  Error: {error}")

# Test 8: Quick test function
print("\n[Test 8] Quick test function:")
code8 = """
def spike_function(t, ctx):
    import random
    return random.random() > 0.5
"""
success, message = test_function_quick(code8)
print(f"  Success: {success}")
print(f"  Message: {message}")

print("\n" + "=" * 60)
print("All tests completed!")
print("=" * 60)
