"""
Custom Exceptions Module

Defines custom exception classes for the SNNverse backend.
"""

from typing import Optional


class SNNverseException(Exception):
    """Base exception for all SNNverse errors."""
    
    def __init__(self, message: str, details: Optional[dict] = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


class ModelBuildError(SNNverseException):
    """Raised when GeNN model building fails."""
    pass


class SimulationError(SNNverseException):
    """Raised when simulation execution fails."""
    pass


class ProcessError(SNNverseException):
    """Raised when process management fails."""
    pass


class SandboxError(SNNverseException):
    """Raised when sandbox execution fails."""
    pass


class ValidationError(SNNverseException):
    """Raised when input validation fails."""
    pass


class CompilationError(SNNverseException):
    """Raised when C++ compilation fails."""
    pass
