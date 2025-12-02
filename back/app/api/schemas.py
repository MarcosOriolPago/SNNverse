from pydantic import BaseModel
from typing import Optional


class CustomFunctionPayload(BaseModel):
    """Payload for executing a custom spike function"""
    node_id: str
    function_code: str


class FunctionExecutionResult(BaseModel):
    """Result of custom function execution"""
    success: bool
    spike: Optional[bool] = None  # True/False if success, None if error
    error: Optional[str] = None
    message: str