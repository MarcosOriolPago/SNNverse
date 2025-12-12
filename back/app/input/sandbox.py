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


def prepare_spike_function(code: str) -> Tuple[bool, Any, str]:
    """
    Prepare a user-defined spike function for repeated execution.
    Executes the code once to define functions and variables.
    
    Args:
        code: Python code containing the function definition
        
    Returns:
        Tuple of (success, function_object, error_message)
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
            return False, None, "No function found in code. Please define a function like 'def spike(t, ctx):'"
            
        return True, func, ""
        
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        return False, None, error_msg


def execute_prepared_function(
    func: Any,
    time_value: float,
    context: Dict[str, Any],
    timeout_seconds: float = 1.0
) -> Tuple[bool, Any, str]:
    """
    Execute a previously prepared function.
    
    Args:
        func: The function object returned by prepare_spike_function
        time_value: Current simulation time
        context: Context dictionary
        timeout_seconds: Maximum execution time
        
    Returns:
        Tuple of (success, result, error_message)
    """
    # Set timeout
    if sys.platform != 'win32':
        try:
            signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(int(timeout_seconds))
        except ValueError:
            # Signals only work in main thread
            # Proceed without timeout protection for now
            pass
    
    try:
        result = func(time_value, context)
        
        # Validate result is boolean
        if not isinstance(result, bool):
            return False, None, f"Function must return True or False, got {type(result).__name__}"
            
        return True, result, ""
        
    except TimeoutException:
        return False, None, "Function execution timed out"
    
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        return False, None, error_msg
    
    finally:
        # Cancel the alarm
        if sys.platform != 'win32':
            try:
                signal.alarm(0)
            except ValueError:
                pass


def execute_spike_function(
    code: str, 
    time_value: float, 
    context: Dict[str, Any],
    timeout_seconds: float = 1.0
) -> Tuple[bool, Any, str]:
    """
    Legacy wrapper for one-off execution.
    """
    success, func, error = prepare_spike_function(code)
    if not success:
        return False, None, error
        
    return execute_prepared_function(func, time_value, context, timeout_seconds)


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
