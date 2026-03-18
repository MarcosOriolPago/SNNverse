"""
API Schemas (Pydantic Models)

Request/response models for the REST API.
These are the HTTP contract — what the frontend sends and receives.
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any


# ─── Request Models ─────────────────────────────────────────────────

class NodeDef(BaseModel):
    """A node in the network graph (from frontend)."""
    id: str
    type: str = "LIF"
    params: Optional[Dict[str, Any]] = {}
    size: Optional[Any] = 1
    position: Optional[Dict[str, Any]] = {"x": 0, "y": 0}


class EdgeDef(BaseModel):
    """An edge (synapse) in the network graph (from frontend)."""
    source: str
    target: str
    data: Optional[Dict[str, Any]] = {}


class NetworkPayload(BaseModel):
    """Complete network submitted from the frontend."""
    nodes: List[NodeDef]
    edges: List[EdgeDef]
    network_name: Optional[str] = None
    network_id: Optional[str] = None  # If provided, update this specific network by ID
    save_as_template: bool = False


class OfflineConfigPayload(BaseModel):
    """Configuration for offline simulation."""
    duration: float = 1000.0
    dt: float = 1.0


class CustomFunctionPayload(BaseModel):
    """Payload for executing a custom spike function in sandbox."""
    node_id: str
    function_code: str


class ConnectionCodePayload(BaseModel):
    """Payload for testing connection code in sandbox."""
    code: str
    n1: int = 5
    n2: int = 5


# ─── Response Models ────────────────────────────────────────────────

class FunctionExecutionResult(BaseModel):
    """Result of custom function execution."""
    success: bool
    spike: Optional[bool] = None
    error: Optional[str] = None
    message: str
    console_output: Optional[str] = ""


class ConnectionCodeResult(BaseModel):
    """Result of connection code testing."""
    success: bool
    message: str
    console_output: str = ""
    stats: Optional[Dict[str, Any]] = None