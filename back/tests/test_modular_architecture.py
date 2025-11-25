#!/usr/bin/env python3
"""
End-to-End Test Suite for Modular Architecture

Tests the complete pipeline:
1. Build GeNN model
2. Launch C++ runner
3. Launch input provider
4. Verify TCP communication
5. Verify WebSocket output
6. Clean shutdown
"""

import os
import sys
import time
import socket
import json
import subprocess
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from ..app.genn_builder import GeNNNetworkBuilder
from ..app.process_manager import ProcessManager
from ..app.input_provider import SimpleTestProvider


class TestResults:
    def __init__(self):
        self.tests = []
        self.passed = 0
        self.failed = 0
    
    def add(self, name, passed, message=""):
        self.tests.append({"name": name, "passed": passed, "message": message})
        if passed:
            self.passed += 1
            print(f"  ✅ {name}")
        else:
            self.failed += 1
            print(f"  ❌ {name}: {message}")
    
    def summary(self):
        print("\n" + "=" * 70)
        print("Test Results Summary")
        print("=" * 70)
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Total:  {len(self.tests)}")
        
        if self.failed > 0:
            print("\nFailed Tests:")
            for test in self.tests:
                if not test["passed"]:
                    print(f"  - {test['name']}: {test['message']}")
        
        return self.failed == 0


def test_1_build_model(results: TestResults):
    """Test 1: Build a simple GeNN model."""
    print("\n" + "=" * 70)
    print("Test 1: Build GeNN Model")
    print("=" * 70)
    
    try:
        # Create simple network
        network = {
            "nodes": [
                {"id": "neuron1", "type": "LIF", "params": {"threshold": -55.0, "tau": 20.0}}
            ],
            "edges": []
        }
        
        # Build model
        builder = GeNNNetworkBuilder(backend="auto")
        code_path, info = builder.build_from_json(network)
        
        results.add("Model builds successfully", True)
        
        # Check backend metadata exists
        backend_info_path = os.path.join(code_path, "backend_info.json")
        exists = os.path.exists(backend_info_path)
        results.add("Backend metadata exists", exists, 
                   f"Missing: {backend_info_path}" if not exists else "")
        
        # Check librunner.so exists
        lib_path = os.path.join(code_path, "librunner.so")
        exists = os.path.exists(lib_path)
        results.add("Model library exists", exists,
                   f"Missing: {lib_path}" if not exists else "")
        
        # Create neuron metadata for runner
        neuron_metadata = {
            "neurons": [{"id": "neuron1", "name": "neuron1", "size": 1}]
        }
        metadata_path = os.path.join(code_path, "neuron_metadata.json")
        with open(metadata_path, 'w') as f:
            json.dump(neuron_metadata, f)
        
        results.add("Neuron metadata created", True)
        
        return code_path
        
    except Exception as e:
        results.add("Model builds successfully", False, str(e))
        return None


def test_2_launch_cpp_runner(results: TestResults, model_path: str):
    """Test 2: Launch C++ runner subprocess."""
    print("\n" + "=" * 70)
    print("Test 2: Launch C++ Runner")
    print("=" * 70)
    
    try:
        pm = ProcessManager()
        
        # Start C++ runner
        success = pm.start_cpp_runner(model_path, ws_port=9002, input_port=9001)
        results.add("C++ runner starts", success, "Failed to start process")
        
        if not success:
            return None, None
        
        # Wait for initialization
        time.sleep(2)
        
        # Check if still running
        status = pm.get_status()
        running = status["cpp_runner"]["running"]
        results.add("C++ runner is running", running, "Process exited")
        
        # Try to connect to TCP port
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            sock.connect(("localhost", 9001))
            sock.close()
            results.add("TCP port 9001 is open", True)
        except Exception as e:
            results.add("TCP port 9001 is open", False, str(e))
        
        # Try to connect to WebSocket port
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            sock.connect(("localhost", 9002))
            sock.close()
            results.add("WebSocket port 9002 is open", True)
        except Exception as e:
            results.add("WebSocket port 9002 is open", False, str(e))
        
        return pm, model_path
        
    except Exception as e:
        results.add("C++ runner starts", False, str(e))
        return None, None


def test_3_tcp_communication(results: TestResults):
    """Test 3: Test TCP communication with C++ runner."""
    print("\n" + "=" * 70)
    print("Test 3: TCP Communication")
    print("=" * 70)
    
    try:
        # Connect to TCP port
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        sock.connect(("localhost", 9001))
        
        results.add("TCP connection established", True)
        
        # Send spike command
        cmd = {"type": "spike", "neuron_id": "neuron1", "time": 10.0}
        sock.sendall((json.dumps(cmd) + "\n").encode('utf-8'))
        results.add("Spike command sent", True)
        
        # Send current command
        cmd = {"type": "current", "neuron_id": "neuron1", "value": 5.0}
        sock.sendall((json.dumps(cmd) + "\n").encode('utf-8'))
        results.add("Current command sent", True)
        
        # Keep connection open briefly
        time.sleep(1)
        
        sock.close()
        results.add("TCP connection closed", True)
        
        return True
        
    except Exception as e:
        results.add("TCP communication works", False, str(e))
        return False


def test_4_input_provider(results: TestResults, pm: ProcessManager):
    """Test 4: Launch input provider and verify it connects."""
    print("\n" + "=" * 70)
    print("Test 4: Input Provider")
    print("=" * 70)
    
    try:
        # Start simple input provider
        success = pm.start_input_provider("simple", {
            "neuron_id": "neuron1",
            "interval": 0.5
        })
        
        results.add("Input provider starts", success, "Failed to start")
        
        if not success:
            return False
        
        # Wait for it to connect and send some messages
        time.sleep(3)
        
        # Check if still running
        status = pm.get_status()
        running = status["input_provider"]["running"]
        results.add("Input provider is running", running, "Process exited")
        
        return True
        
    except Exception as e:
        results.add("Input provider works", False, str(e))
        return False


def test_5_websocket_output(results: TestResults):
    """Test 5: Verify WebSocket is streaming data."""
    print("\n" + "=" * 70)
    print("Test 5: WebSocket Output")
    print("=" * 70)
    
    try:
        # Note: Full WebSocket testing requires websocket-client library
        # For now, just verify the port is open and accepting connections
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        sock.connect(("localhost", 9002))
        
        # Send HTTP upgrade request (simplified WebSocket handshake)
        request = (
            "GET / HTTP/1.1\r\n"
            "Host: localhost:9002\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            "\r\n"
        )
        sock.sendall(request.encode('utf-8'))
        
        # Try to receive response
        response = sock.recv(1024).decode('utf-8')
        
        # Check if upgrade was accepted
        if "101" in response or "Upgrade" in response:
            results.add("WebSocket handshake accepted", True)
        else:
            results.add("WebSocket handshake accepted", False, f"Unexpected response: {response[:100]}")
        
        sock.close()
        return True
        
    except Exception as e:
        results.add("WebSocket is accessible", False, str(e))
        return False


def test_6_shutdown(results: TestResults, pm: ProcessManager):
    """Test 6: Clean shutdown of all processes."""
    print("\n" + "=" * 70)
    print("Test 6: Clean Shutdown")
    print("=" * 70)
    
    try:
        # Stop all processes
        pm.stop_all(timeout=5)
        
        # Verify all stopped
        status = pm.get_status()
        
        cpp_stopped = not status["cpp_runner"]["running"]
        results.add("C++ runner stopped", cpp_stopped, "Still running")
        
        input_stopped = not status["input_provider"]["running"]
        results.add("Input provider stopped", input_stopped, "Still running")
        
        return cpp_stopped and input_stopped
        
    except Exception as e:
        results.add("Clean shutdown", False, str(e))
        return False


def main():
    print("=" * 70)
    print("Modular Architecture End-to-End Test Suite")
    print("=" * 70)
    
    results = TestResults()
    pm = None
    
    try:
        # Test 1: Build model
        model_path = test_1_build_model(results)
        if not model_path:
            print("\n❌ Cannot continue without model")
            results.summary()
            return 1
        
        # Test 2: Launch C++ runner
        pm, _ = test_2_launch_cpp_runner(results, model_path)
        if not pm:
            print("\n❌ Cannot continue without C++ runner")
            results.summary()
            return 1
        
        # Test 3: TCP communication
        test_3_tcp_communication(results)
        
        # Test 4: Input provider
        test_4_input_provider(results, pm)
        
        # Test 5: WebSocket output
        test_5_websocket_output(results)
        
        # Test 6: Shutdown
        test_6_shutdown(results, pm)
        
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Ensure cleanup
        if pm:
            try:
                pm.stop_all()
            except:
                pass
    
    # Print summary
    success = results.summary()
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
