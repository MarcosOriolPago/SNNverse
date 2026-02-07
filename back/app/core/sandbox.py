import ast
import signal
import sys
import threading
import io
from typing import Any, Dict, Callable, Optional, Tuple

class Sandbox:
    """
    Generic Python Sandbox for SNNverse plugins.
    Encapsulates the environment and execution safety logic.
    """
    
    def __init__(self, allowed_modules: list = ['math', 'random', 'time']):
        self.allowed_modules = allowed_modules
        self.safe_globals = self._create_env()

    def _create_env(self) -> Dict[str, Any]:
        # Implementation derived from your existing functional logic
        return {
            "__builtins__": self._create_safe_builtins(),
            "math": __import__('math'),
            "random": __import__('random'),
            "time": __import__('time')
        }

    def _create_safe_builtins(self):
        # Using the whitelist strategy from your original code
        return {
            'abs': abs, 'min': min, 'max': max, 'int': int, 'float': float, 
            'bool': bool, 'list': list, 'dict': dict, 'print': print, # Added print for debugging
            '__import__': self._safe_import
        }

    def _safe_import(self, name, *args, **kwargs):
        """Restricted import function."""
        if name in self.allowed_modules:
            return __import__(name, *args, **kwargs)
        raise ImportError(f"Import of module '{name}' is not allowed in sandbox. Allowed: {self.allowed_modules}")

    def compile_function(self, code: str, func_name: str = None) -> Tuple[bool, Optional[Callable], str]:
        """Compiles code and extracts the primary function."""
        # 1. Validate Syntax
        try:
            ast.parse(code)
        except SyntaxError as e:
            return False, None, f"Syntax error: {e.msg} at line {e.lineno}"

        # 2. Execute definition
        local_vars = {}
        try:
            # We don't usually capture stdout during definition, but we could.
            # For now, let's keep it simple and only capture during execution.
            exec(code, self.safe_globals, local_vars)
        except Exception as e:
            return False, None, f"Definition error: {str(e)}"
        
        # 3. Extract Callable
        target_func = None
        if func_name and func_name in local_vars:
            target_func = local_vars[func_name]
        else:
            # Fallback: find first non-private callable
            for obj in local_vars.values():
                if callable(obj) and not getattr(obj, '__name__', '').startswith('_'):
                    target_func = obj
                    break
        
        if not target_func:
            return False, None, "No valid function found in sandbox code."

        return True, target_func, ""

    def execute(self, func: Callable, *args, timeout=0.5, **kwargs) -> Tuple[Any, str]:
        """
        Executes a pre-compiled function with a hard timeout.
        Returns (result, captured_stdout).
        """
        # Signal only works in main thread
        use_timeout = sys.platform != 'win32' and threading.current_thread() is threading.main_thread()
        
        # Capture stdout
        capture_buffer = io.StringIO()
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        
        if use_timeout:
            signal.signal(signal.SIGALRM, self._timeout_handler)
            signal.alarm(int(timeout) + 1) # basic granularity
        
        try:
            sys.stdout = capture_buffer
            sys.stderr = capture_buffer
            result = func(*args, **kwargs)
            return result, capture_buffer.getvalue()
        except Exception as e:
             # Capture what we have so far even if it failed
             sys.stdout = old_stdout # Reset before raising
             sys.stderr = old_stderr
             raise e # Re-raise for the adapter to handle
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr
            if use_timeout:
                signal.alarm(0)

    @staticmethod
    def _timeout_handler(signum, frame):
        raise TimeoutError("Sandbox execution timed out")

def test_function(code: str) -> Tuple[bool, str, str]:
    """
    Quickly tests if a function compiles and runs (for one step).
    Returns (Success, Message, ConsoleOutput).
    """
    sandbox = Sandbox()
    success, func, error = sandbox.compile_function(code)
    
    if not success:
        return False, f"Compilation failed: {error}", ""
    
    try:
        # Pass dummy context
        result, console_out = sandbox.execute(func, 0, {"test": "data"}, timeout=1.0)
        return True, f"Execution successful. Result: {result}", console_out
    except Exception as e:
        # In case of runtime error, we might still want to return captured output if we could,
        # but execute() re-raises exceptions. 
        # Ideally we'd wrap execution to capture output even on failure, 
        # but let's stick to the interface for now.
        return False, f"Runtime error: {str(e)}", ""