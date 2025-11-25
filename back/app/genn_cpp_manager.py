"""
GeNN C++ Runner Manager

This module manages the C++ GeNN runner as a subprocess.
The C++ runner provides:
- Direct execution of GeNN simulation (no Python overhead)
- WebSocket streaming with optimized protocol:
  * Voltage: Every 20ms
  * Spikes: Immediately, ID only

Workflow:
1. Python builds GeNN model → generates C++ code
2. Python launches C++ runner subprocess
3. C++ runner loads .so, runs simulation, streams via WebSocket
4. Frontend connects to C++ runner's WebSocket directly
"""

import subprocess
import time
import os
import signal
import json
from typing import Optional, Dict, Any
from pathlib import Path


class GeNNCppRunner:
    """
    Manages the C++ GeNN runner subprocess.
    """
    
    def __init__(self, cpp_runner_path: str = None):
        """
        Initialize the C++ runner manager.
        
        Args:
            cpp_runner_path: Path to genn_runner executable.
                           If None, uses back/cpp_runner/build/genn_runner
        """
        if cpp_runner_path is None:
            # Default path
            back_dir = Path(__file__).parent.parent
            cpp_runner_path = back_dir / "cpp_runner" / "build" / "genn_runner"
        
        self.cpp_runner_path = Path(cpp_runner_path)
        self.process: Optional[subprocess.Popen] = None
        self.websocket_port = 9002  # Default WebSocket port for C++ runner
        self.model_code_path: Optional[str] = None
        
    def is_built(self) -> bool:
        """Check if C++ runner is compiled."""
        return self.cpp_runner_path.exists() and os.access(self.cpp_runner_path, os.X_OK)
    
    def build_runner(self) -> bool:
        """
        Build the C++ runner using build.sh script.
        
        Returns:
            True if build successful, False otherwise
        """
        build_script = self.cpp_runner_path.parent.parent / "build.sh"
        
        if not build_script.exists():
            print(f"Build script not found: {build_script}")
            return False
        
        print("Building C++ GeNN runner...")
        try:
            # Make sure build script is executable
            os.chmod(build_script, 0o755)
            
            # Run build script
            result = subprocess.run(
                [str(build_script)],
                cwd=build_script.parent,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                print("✓ C++ runner built successfully")
                return True
            else:
                print(f"Build failed:\n{result.stderr}")
                return False
                
        except subprocess.TimeoutExpired:
            print("Build timed out after 60 seconds")
            return False
        except Exception as e:
            print(f"Build error: {e}")
            return False
    
    def start(self, model_code_path: str, port: int = 9002, 
              neuron_ids: list = None) -> bool:
        """
        Start the C++ runner process.
        
        Args:
            model_code_path: Path to GeNN generated code directory (user_network_CODE)
            port: WebSocket port for C++ runner
            neuron_ids: List of neuron IDs from frontend (for registration)
            
        Returns:
            True if started successfully, False otherwise
        """
        if self.process and self.process.poll() is None:
            print("C++ runner already running")
            return False
        
        if not self.is_built():
            print("C++ runner not built. Building now...")
            if not self.build_runner():
                return False
        
        self.model_code_path = model_code_path
        self.websocket_port = port
        
        # Create metadata file for C++ runner to read neuron IDs
        if neuron_ids:
            self._create_metadata_file(model_code_path, neuron_ids)
        
        # Start C++ runner subprocess
        cmd = [
            str(self.cpp_runner_path),
            model_code_path,
            str(port)
        ]
        
        print(f"Starting C++ runner: {' '.join(cmd)}")
        
        try:
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,  # Line buffered
                universal_newlines=True
            )
            
            # Wait a moment and check if process started
            time.sleep(0.5)
            
            if self.process.poll() is not None:
                # Process died immediately
                stdout, stderr = self.process.communicate()
                print(f"C++ runner failed to start:\n{stderr}")
                return False
            
            print(f"C++ runner started (PID: {self.process.pid})")
            print(f"WebSocket listening on port {port}")
            return True
            
        except Exception as e:
            print(f"Failed to start C++ runner: {e}")
            return False
    
    def stop(self, timeout: float = 5.0) -> bool:
        """
        Stop the C++ runner process gracefully.
        
        Args:
            timeout: Seconds to wait for graceful shutdown
            
        Returns:
            True if stopped successfully, False otherwise
        """
        if not self.process or self.process.poll() is not None:
            print("C++ runner not running")
            return True
        
        print("Stopping C++ runner...")
        
        try:
            # Try graceful shutdown first (SIGTERM)
            self.process.terminate()
            
            try:
                self.process.wait(timeout=timeout)
                print("✓ C++ runner stopped gracefully")
                return True
            except subprocess.TimeoutExpired:
                # Force kill if not responding
                print("Forcing C++ runner to stop...")
                self.process.kill()
                self.process.wait(timeout=2.0)
                print("✓ C++ runner stopped (forced)")
                return True
                
        except Exception as e:
            print(f"Error stopping C++ runner: {e}")
            return False
        finally:
            self.process = None
    
    def is_running(self) -> bool:
        """Check if C++ runner is currently running."""
        return self.process is not None and self.process.poll() is None
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get current status of C++ runner.
        
        Returns:
            Dictionary with status information
        """
        return {
            "running": self.is_running(),
            "pid": self.process.pid if self.process else None,
            "websocket_port": self.websocket_port if self.is_running() else None,
            "model_path": self.model_code_path if self.is_running() else None,
            "executable": str(self.cpp_runner_path),
            "built": self.is_built()
        }
    
    def _create_metadata_file(self, model_code_path: str, neuron_ids: list):
        """
        Create a metadata JSON file for C++ runner to read neuron IDs.
        
        Args:
            model_code_path: Path to generated code directory
            neuron_ids: List of neuron ID strings
        """
        metadata = {
            "neurons": [{"id": nid, "name": nid, "size": 1} for nid in neuron_ids],
            "dt": 0.1,
            "voltage_emit_interval_ms": 20.0
        }
        
        metadata_path = Path(model_code_path) / "neuron_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"Created metadata file: {metadata_path}")


# Singleton instance
cpp_runner = GeNNCppRunner()


# Example usage
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python genn_cpp_manager.py <model_code_path>")
        print("Example: python genn_cpp_manager.py /tmp/genn_models_xyz/user_network_CODE")
        sys.exit(1)
    
    model_path = sys.argv[1]
    
    # Start runner
    if cpp_runner.start(model_path, port=9002, neuron_ids=["neuron1", "neuron2"]):
        print("\n✓ C++ runner started successfully")
        print(f"Connect to ws://localhost:9002")
        print("\nPress Ctrl+C to stop...")
        
        try:
            # Keep running until interrupted
            while cpp_runner.is_running():
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n\nStopping...")
            cpp_runner.stop()
    else:
        print("\nFailed to start C++ runner")
        sys.exit(1)
