"""
Python Sandbox Module

Provides safe execution environment for user-defined Python code.
Restricts imports, builtins, and execution time to prevent malicious code.
"""

import ast
import signal
import sys
from typing import Any, Dict, Tuple
import math
import random
import time as time_module

from ..core.config import config
from ..core.exceptions import SandboxError


class TimeoutException(Exception):
    """Raised when execution times out"""
    pass


def timeout_handler(signum, frame):
    """Signal handler for execution timeout."""
    raise TimeoutException("Function execution timed out")


def validate_syntax(code: str) -> Tuple[bool, str]:
    """
    Validate Python code syntax without executing it.
    
    Args:
        code: Python code to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        ast.parse(code)
        return True, ""
    except SyntaxError as e:
        return False, f"Syntax error: {e.msg} at line {e.lineno}"
    except Exception as e:
        return False, f"Parse error: {str(e)}"


def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
    """
    Restricted import that only allows whitelisted modules.
    
    Args:
        name: Module name to import
        
    Returns:
        Imported module
        
    Raises:
        ImportError: If module is not in whitelist
    """
    allowed_modules = config.SANDBOX_ALLOWED_MODULES
    
    # Get the base module name
    base_module = name.split('.')[0]
    
    if base_module not in allowed_modules:
        raise ImportError(f"Module '{name}' is not allowed. Only {allowed_modules} are permitted.")
    
    return __import__(name, globals, locals, fromlist, level)


def create_safe_builtins() -> Dict[str, Any]:
    """
    Create a restricted set of builtins for safe execution.
    Only allows mathematical and basic operations.
    """
    safe_builtins = {
        'abs': abs,
        'min': min,
        'max': max,
        'sum': sum,
        'round': round,
        'len': len,
        'range': range,
        'int': int,
        'float': float,
        'bool': bool,
        'str': str,
        'list': list,
        'dict': dict,
        'tuple': tuple,
        'True': True,
        'False': False,
        'None': None,
        '__import__': safe_import,
    }
    return safe_builtins


def create_safe_modules() -> Dict[str, Any]:
    """
    Provide safe module references (whitelisted).
    """
    return {
        'math': math,
        'random': random,
        'time': time_module,
    }


def execute_spike_function(
    code: str, 
    time_value: float, 
    context: Dict[str, Any],
    timeout_seconds: float = 1.0
) -> Tuple[bool, Any, str]:
    """
    Safely execute a user-defined spike function.
    
    Args:
        code: Python code containing the function definition
        time_value: Current simulation time to pass to function
        context: Additional context dictionary to pass to function
        timeout_seconds: Maximum execution time
        
    Returns:
        Tuple of (success, result, error_message)
        - success: Whether execution succeeded
        - result: The boolean return value (True/False for spike/no-spike)
        - error_message: Error description if success is False
    """
    # First validate syntax
    is_valid, error = validate_syntax(code)
    if not is_valid:
        return False, None, error
    
    # Create safe execution environment
    safe_globals = {
        '__builtins__': create_safe_builtins(),
        **create_safe_modules()
    }
    
    safe_locals = {}
    
    # Set timeout (Unix-only, but fine for Linux Mint)
    if sys.platform != 'win32':
        signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(int(timeout_seconds))
    
    try:
        # Execute the code to define the function
        exec(code, safe_globals, safe_locals)
        
        # Find the function (assume it's the first function defined)
        func = None
        for name, obj in safe_locals.items():
            if callable(obj) and not name.startswith('_'):
                func = obj
                break
        
        if func is None:
            return False, None, "No function found in code. Please define a function."
        
        # Call the function with time and context
        result = func(time_value, context)
        
        # Validate result is boolean
        if not isinstance(result, bool):
            return False, None, f"Function must return True or False, got {type(result).__name__}"
        
        return True, result, ""
        
    except TimeoutException:
        return False, None, "Function execution timed out (max 1 second)"
    
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        return False, None, error_msg
    
    finally:
        # Cancel the alarm
        if sys.platform != 'win32':
            signal.alarm(0)


def test_function_quick(code: str) -> Tuple[bool, str]:
    """
    Quick test of a function with dummy values.
    Returns (success, message)
    """
    success, result, error = execute_spike_function(
        code=code,
        time_value=0.0,
        context={'test': True},
        timeout_seconds=1.0
    )
    
    if success:
        spike_status = "SPIKE" if result else "NO SPIKE"
        return True, f"Function executed successfully: {spike_status}"
    else:
        return False, error
