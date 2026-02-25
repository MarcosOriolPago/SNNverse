"""
Core Type Definitions

Typed contracts between all backend layers.
These dataclasses define the exact shape of data flowing between components:

    Frontend JSON → [NodeConfig, EdgeConfig] → Builder
    Builder → [BuildResult] → Manager
    Manager → [SimulationResult] → Route Response
    SessionStore → [VoltageFrame] → Frontend Playback

Every function that crosses a boundary MUST use these types.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional


# ─── Frontend → Backend ─────────────────────────────────────────────

@dataclass
class NodeConfig:
    """A single node from the frontend graph."""
    id: str
    type: str           # "LIF", "SPIKE_FX", "KEYBOARD", "IZHIKEVICH"
    params: Dict[str, Any] = field(default_factory=dict)
    size: int = 1
    position: Optional[Dict[str, Any]] = None


@dataclass
class EdgeConfig:
    """A single edge (synapse) from the frontend graph."""
    source: str
    target: str
    data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NetworkConfig:
    """Complete network definition from the frontend."""
    nodes: List[NodeConfig]
    edges: List[EdgeConfig]
    name: Optional[str] = None


# ─── Builder → Manager ──────────────────────────────────────────────

@dataclass
class PopulationInfo:
    """Metadata about a single GeNN neuron population."""
    name: str               # GeNN population name (sanitized)
    original_id: str        # Original frontend node ID
    neuron_type: str        # "LIF", "IZHIKEVICH", "SpikeSourceArray"
    size: int               # Number of neurons
    has_voltage: bool       # True if population has a "V" variable
    spike_recording: bool   # True if spike recording is enabled


@dataclass
class BuildResult:
    """Output of a successful model build."""
    code_path: str
    model_id: str
    backend: str
    populations: Dict[str, PopulationInfo]  # keyed by original node ID


# ─── Runtime → Manager ──────────────────────────────────────────────

@dataclass
class SimulationResult:
    """Output of an offline simulation run."""
    session_id: str
    spike_data: Dict[str, Dict[str, list]]  # {pop_name: {"times": [...], "ids": [...]}}
    voltage_file: str                        # Path to binary voltage file
    duration_ms: float
    dt: float
    wall_time_s: float
    steps_run: int
    populations: Dict[str, PopulationInfo]   # For the reader to know frame layout


# ─── Session Store → Frontend ────────────────────────────────────────

@dataclass
class VoltageFrame:
    """A single frame of voltage data for playback."""
    time: float
    voltages: Dict[str, List[float]]  # {pop_name: [v0, v1, ...]}


@dataclass
class SessionInfo:
    """Metadata stored for a simulation session (for voltage file seeking)."""
    file_path: str
    dt: float
    total_neurons: int              # Sum of all population sizes (with V)
    pop_keys: List[str]             # Sorted population names (with V)
    pop_sizes: Dict[str, int]       # {pop_name: num_neurons}
    total_steps: int                # Total frames written to file
