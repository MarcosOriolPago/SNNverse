"""
Connection Code Sandbox

Executes user-written Python code that defines layer-to-layer connectivity.

Environment provided to user code:
    n1  — source population size (int)
    n2  — target population size (int)

Functions provided:
    connect(i, j)              — mark a connection from source i to target j
    set_weight(i, j, weight)   — set connection weight (implies connect)
    disconnect(i, j)           — remove a connection
    set_delay(i, j, delay)     — set synaptic delay (future use)

After execution the sandbox returns a dense weight matrix (numpy ndarray)
of shape (n1, n2). Unconnected pairs have weight 0.0.
"""

import ast
import io
import sys
import signal
import threading
import logging
from typing import Tuple, Optional

import numpy as np

logger = logging.getLogger(__name__)

ALLOWED_IMPORTS = {"math", "random"}

DEFAULT_WEIGHT = 1.0


class ConnectionSandbox:
    """Restricted Python sandbox for connection code execution."""

    def __init__(self, n1: int, n2: int):
        self.n1 = n1
        self.n2 = n2
        self.weights = np.zeros((n1, n2), dtype=np.float32)
        self._stdout = io.StringIO()

    def _safe_import(self, name, *args, **kwargs):
        if name in ALLOWED_IMPORTS:
            return __import__(name, *args, **kwargs)
        raise ImportError(
            f"Import of '{name}' is not allowed. Allowed: {sorted(ALLOWED_IMPORTS)}"
        )

    def _connect(self, i: int, j: int):
        if not (0 <= i < self.n1 and 0 <= j < self.n2):
            raise IndexError(
                f"connect({i}, {j}) out of bounds (n1={self.n1}, n2={self.n2})"
            )
        if self.weights[i, j] == 0.0:
            self.weights[i, j] = DEFAULT_WEIGHT

    def _set_weight(self, i: int, j: int, weight: float):
        if not (0 <= i < self.n1 and 0 <= j < self.n2):
            raise IndexError(
                f"set_weight({i}, {j}, ...) out of bounds (n1={self.n1}, n2={self.n2})"
            )
        self.weights[i, j] = float(weight)

    def _disconnect(self, i: int, j: int):
        if not (0 <= i < self.n1 and 0 <= j < self.n2):
            raise IndexError(
                f"disconnect({i}, {j}) out of bounds (n1={self.n1}, n2={self.n2})"
            )
        self.weights[i, j] = 0.0

    def _set_delay(self, i: int, j: int, delay: float):
        pass

    def _safe_print(self, *args, **kwargs):
        kwargs["file"] = self._stdout
        print(*args, **kwargs)

    def _build_env(self):
        env = {
            "__builtins__": {
                "abs": abs, "min": min, "max": max, "sum": sum,
                "int": int, "float": float, "bool": bool,
                "range": range, "len": len, "enumerate": enumerate,
                "list": list, "dict": dict, "tuple": tuple, "set": set,
                "sorted": sorted, "reversed": reversed, "zip": zip, "map": map,
                "round": round, "pow": pow,
                "print": self._safe_print,
                "True": True, "False": False, "None": None,
                "__import__": self._safe_import,
            },
            "math": __import__("math"),
            "random": __import__("random"),
            "n1": self.n1,
            "n2": self.n2,
            "connect": self._connect,
            "set_weight": self._set_weight,
            "disconnect": self._disconnect,
            "set_delay": self._set_delay,
        }
        # Add s0, s1, ... (source indices) and t0, t1, ... (target indices)
        for i in range(max(self.n1, self.n2)):
            if i < self.n1:
                env[f"s{i}"] = i
            if i < self.n2:
                env[f"t{i}"] = i
        return env

    def execute(self, code: str, timeout: float = 5.0) -> Tuple[np.ndarray, str]:
        """
        Execute connection code and return (weight_matrix, console_output).
        Raises on syntax/runtime errors.
        """
        ast.parse(code)

        env = self._build_env()
        use_alarm = (
            sys.platform != "win32"
            and threading.current_thread() is threading.main_thread()
        )

        old_stdout, old_stderr = sys.stdout, sys.stderr
        sys.stdout = self._stdout
        sys.stderr = self._stdout

        if use_alarm:
            signal.signal(signal.SIGALRM, _timeout_handler)
            signal.alarm(int(timeout) + 1)

        try:
            exec(code, env)  # noqa: S102
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr
            if use_alarm:
                signal.alarm(0)

        return self.weights.copy(), self._stdout.getvalue()


def _timeout_handler(signum, frame):
    raise TimeoutError("Connection code execution timed out")


def execute_connection_code(
    code: str, n1: int, n2: int, timeout: float = 5.0
) -> Tuple[np.ndarray, str]:
    """
    Convenience wrapper: execute connection code and return weight matrix + output.
    """
    sandbox = ConnectionSandbox(n1, n2)
    return sandbox.execute(code, timeout)


def test_connection_code(
    code: str, n1: int, n2: int
) -> Tuple[bool, str, str, Optional[dict]]:
    """
    Test connection code without side effects.

    Returns (success, message, console_output, stats_dict).
    stats_dict includes: total_connections, weight_min, weight_max, weight_mean,
    connections (list of [i, j] pairs for animation).
    """
    try:
        weights, console = execute_connection_code(code, n1, n2, timeout=3.0)
        mask = weights != 0.0
        total = int(np.count_nonzero(mask))
        # Connections as [i, j] pairs, ordered left-to-right (by source i, then target j)
        connections = [
            [int(i), int(j)]
            for i, j in zip(*np.where(mask))
        ]
        connections.sort(key=lambda c: (c[0], c[1]))
        stats = {
            "total_connections": total,
            "total_possible": n1 * n2,
            "density": round(total / max(n1 * n2, 1), 4),
            "weight_min": float(np.min(weights[mask])) if total > 0 else 0.0,
            "weight_max": float(np.max(weights[mask])) if total > 0 else 0.0,
            "weight_mean": float(np.mean(weights[mask])) if total > 0 else 0.0,
            "connections": connections,
        }
        msg = (
            f"OK: {total}/{n1*n2} connections "
            f"(density {stats['density']:.1%}), "
            f"weight range [{stats['weight_min']:.3f}, {stats['weight_max']:.3f}]"
        )
        return True, msg, console, stats
    except SyntaxError as e:
        return False, f"Syntax error at line {e.lineno}: {e.msg}", "", None
    except TimeoutError:
        return False, "Code execution timed out (max 3s)", "", None
    except Exception as e:
        return False, f"Runtime error: {e}", "", None
