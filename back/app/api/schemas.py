from pydantic import BaseModel
from typing import Optional, List, Dict, Any


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

class NodeDef(BaseModel):
    id: str
    type: str
    params: Dict[str, Any]
    size: int = 1  # Default to 1 neuron
    position: Dict[str, float] = {"x": 0, "y": 0}  # Node position in canvas

class EdgeDef(BaseModel):
    source: str
    target: str

class NetworkPayload(BaseModel):
    nodes: List[NodeDef]
    edges: List[EdgeDef]
    network_name: str = None  # Optional: name to save this network as