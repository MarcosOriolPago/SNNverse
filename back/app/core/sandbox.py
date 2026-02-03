import ast
import signal
import sys
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
            "random": __import__('random')
        }

    def _create_safe_builtins(self):
        # Using the whitelist strategy from your original code
        return {
            'abs': abs, 'min': min, 'max': max, 'int': int, 'float': float, 
            'bool': bool, 'list': list, 'dict': dict, 'print': print, # Added print for debugging
        }

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

    def execute(self, func: Callable, *args, timeout=0.5, **kwargs) -> Any:
        """Executes a pre-compiled function with a hard timeout."""
        # Use your existing signal logic here
        if sys.platform != 'win32':
            signal.signal(signal.SIGALRM, self._timeout_handler)
            signal.alarm(int(timeout) + 1) # basic granularity
        
        try:
            return func(*args, **kwargs)
        except Exception as e:
             raise e # Re-raise for the adapter to handle
        finally:
            if sys.platform != 'win32':
                signal.alarm(0)

    @staticmethod
    def _timeout_handler(signum, frame):
        raise TimeoutError("Sandbox execution timed out")

def test_function(code: str) -> Tuple[bool, str]:
    """
    Quickly tests if a function compiles and runs (for one step).
    Returns (Success, Message).
    """
    sandbox = Sandbox()
    success, func, error = sandbox.compile_function(code)
    
    if not success:
        return False, f"Compilation failed: {error}"
    
    try:
        # Try running it with dummy inputs
        # We assume the function signature is f(t, ctx) or f(step) from the examples
        # We'll try calling it with (0, {})
        result = sandbox.execute(func, 0, {})
        return True, f"Execution successful. Result: {result}"
    except Exception as e:
        return False, f"Runtime error: {str(e)}"