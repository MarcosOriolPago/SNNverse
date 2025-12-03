"""
Process Manager

Manages C++ runner and input provider as subprocesses.
Handles launching, monitoring, and graceful shutdown.
"""

import subprocess
import sys
import time
from typing import Optional, Dict, Any
from pathlib import Path

from ..core.config import config

class ProcessManager:
    """
    Manages subprocesses for the modular architecture.
    - C++ runner (GeNN model execution)
    - Input provider (Python/sensor/file)
    """
    
    def __init__(self):
        self.cpp_runner_process: Optional[subprocess.Popen] = None
        self.input_provider_process: Optional[subprocess.Popen] = None
        self.cpp_runner_pid: Optional[int] = None
        self.input_provider_pid: Optional[int] = None
        
    def start_cpp_runner(
        self,
        model_path: str,
        ws_port: int = config.WEBSOCKET_PORT,
        input_port: int = config.INPUT_TCP_PORT,
        use_python: bool = True
    ) -> bool:
        """
        Launch the runner subprocess (Python or C++).
        
        Args:
            model_path: Path to the GeNN model CODE directory
            ws_port: WebSocket port for frontend
            input_port: TCP port for input provider
            use_python: If True, use Python runner; if False, use C++ runner
            
        Returns:
            True if started successfully
        """
        # Use compiled template runner (generated during model build)
        runner_path = Path(model_path) / "build" / "network_runner"
        
        if not runner_path.exists():
            print(f"✗ Compiled runner not found at: {runner_path}")
            print("  The runner should have been compiled during model build.")
            return False
        
        try:
            # Launch compiled runner
            self.cpp_runner_process = subprocess.Popen(
                [str(runner_path), str(ws_port), str(input_port)],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
        except Exception as e:
            print(f"✗ Failed to start runner: {e}")
            return False
        
        # Common code for both runners
        self.cpp_runner_pid = self.cpp_runner_process.pid
        
        print(f"✓ Runner started (PID: {self.cpp_runner_pid})")
        print(f"  WebSocket: port {ws_port}")
        print(f"  TCP Input: port {input_port}")
        
        # Give it a moment to start
        time.sleep(0.5)
        
        # Check if it's still running
        if self.cpp_runner_process.poll() is not None:
            print("✗ Runner exited immediately")
            return False
        
        return True
    
    def start_input_provider(
        self,
        provider_type: str,
        config: Dict[str, Any],
        input_port: int = config.INPUT_TCP_PORT
    ) -> bool:
        """
        Launch an input provider subprocess.
        
        Args:
            provider_type: Type of provider ('python', 'simple', 'file')
            config: Configuration for the provider
            input_port: TCP port to connect to (default 9001 for C++ runner TCP spike injection)
            
        Returns:
            True if started successfully
        """
        try:
            # Use current Python interpreter instead of looking for .venv
            python_path = sys.executable
            
            # Python sandbox provider
            user_code = config.get("code", "")
            neuron_id = config.get("neuron_id", "unknown")
            code = f"""
from app.input.python_generator import PythonInputGenerator
provider = PythonInputGenerator(
    code='''{user_code}''',
    neuron_id='{neuron_id}',
    interval={config.get("interval", 0.01)},
    port={input_port}
)
provider.run()
"""
            
            print(f"Starting input provider...")
            print(f"  Python: {python_path}")
            print(f"  Type: {provider_type}")
            print(f"  Target port: {input_port}")
            
            # Launch input provider
            self.input_provider_process = subprocess.Popen(
                [python_path, "-c", code],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                cwd=str(Path(__file__).parent.parent)
            )
            
            self.input_provider_pid = self.input_provider_process.pid
            
            print(f"✓ Input provider started (PID: {self.input_provider_pid})")
            
            return True
            
        except Exception as e:
            print(f"✗ Failed to start input provider: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def stop_all(self, timeout: int = 5):
        """
        Stop all managed processes gracefully.
        
        Args:
            timeout: Seconds to wait before force killing
        """
        print("Stopping all processes...")
        
        # Stop input provider first
        if self.input_provider_process:
            self._stop_process(
                self.input_provider_process,
                "Input provider",
                timeout
            )
            self.input_provider_process = None
            self.input_provider_pid = None
        
        # Stop C++ runner
        if self.cpp_runner_process:
            self._stop_process(
                self.cpp_runner_process,
                "C++ runner",
                timeout
            )
            self.cpp_runner_process = None
            self.cpp_runner_pid = None
        
        print("✓ All processes stopped")
    
    def _stop_process(self, process: subprocess.Popen, name: str, timeout: int):
        """Stop a single process gracefully."""
        if process.poll() is not None:
            print(f"  {name} already stopped")
            return
        
        try:
            # Send SIGTERM
            print(f"  Stopping {name} (PID: {process.pid})...")
            process.terminate()
            
            # Wait for graceful shutdown
            try:
                process.wait(timeout=timeout)
                print(f"  ✓ {name} stopped gracefully")
            except subprocess.TimeoutExpired:
                # Force kill
                print(f"  ⚠️  {name} didn't stop, force killing...")
                process.kill()
                process.wait()
                print(f"  ✓ {name} force killed")
                
        except Exception as e:
            print(f"  ✗ Error stopping {name}: {e}")
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get status of all managed processes.
        
        Returns:
            Dictionary with process information
        """
        return {
            "cpp_runner": {
                "running": self.cpp_runner_process is not None and self.cpp_runner_process.poll() is None,
                "pid": self.cpp_runner_pid
            },
            "input_provider": {
                "running": self.input_provider_process is not None and self.input_provider_process.poll() is None,
                "pid": self.input_provider_pid
            }
        }
    
    def is_running(self) -> bool:
        """Check if any processes are running."""
        status = self.get_status()
        return status["cpp_runner"]["running"] or status["input_provider"]["running"]
    

# Global instance for easy access
process_manager = ProcessManager()


if __name__ == "__main__":
    # Test process manager
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python process_manager.py <model_path>")
        sys.exit(1)
    
    model_path = sys.argv[1]
    
    try:
        # Start C++ runner
        if not process_manager.start_cpp_runner(model_path):
            sys.exit(1)
        
        # Wait a bit for runner to initialize
        time.sleep(2)
        
        # Start simple input provider
        if not process_manager.start_input_provider("simple", {"neuron_id": "neuron1", "interval": 1.0}):
            process_manager.stop_all()
            sys.exit(1)
        
        print("\n✓ All processes running")
        print("Press Ctrl+C to stop\n")
        
        # Monitor
        while process_manager.is_running():
            time.sleep(1)
            status = process_manager.get_status()
            if not status["cpp_runner"]["running"]:
                print("✗ C++ runner stopped unexpectedly")
                break
        
    except KeyboardInterrupt:
        print("\n\nStopping...")
    finally:
        process_manager.stop_all()
