"""
Core Configuration Module

Centralized configuration and constants for the SNNverse backend.
"""

import os
from typing import Optional
from pathlib import Path


class Config:
    """Application configuration and constants."""
    
    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # WebSocket Configuration
    WEBSOCKET_PORT: int = 9002
    INPUT_TCP_PORT: int = 9001
    
    # CORS Configuration
    CORS_ORIGINS: list[str] = ["*"]
    CORS_METHODS: list[str] = ["*"]
    CORS_HEADERS: list[str] = ["*"]
    
    # GeNN Configuration
    GENN_BACKEND_AUTO: str = "auto"
    GENN_BACKEND_CUDA: str = "cuda"
    GENN_BACKEND_CPU: str = "cpu"
    GENN_BACKEND_SINGLE_THREADED: str = "single_threaded_cpu"
    
    # Default neuron parameters
    DEFAULT_LIF_PARAMS = {
        "C": 1.0,           # Capacitance (nF)
        "TauM": 20.0,       # Membrane time constant (ms)
        "Vrest": -65.0,     # Resting potential (mV)
        "Vreset": -65.0,    # Reset potential (mV)
        "Vthresh": -50.0,   # Threshold potential (mV)
        "Ioffset": 0.0,     # Offset current
        "TauRefrac": 2.0    # Refractory period (ms)
    }
    
    DEFAULT_IZHIKEVICH_PARAMS = {
        "a": 0.02,
        "b": 0.2,
        "c": -65.0,
        "d": 8.0
    }
    
    # Simulation Configuration
    DEFAULT_DT: float = 0.1  # Timestep in ms
    VOLTAGE_EMIT_INTERVAL_MS: float = 20.0  # How often to emit voltage updates
    NUM_RECORDING_TIMESTEPS: int = 30  # Number of timesteps to keep in recording buffer
    MAX_INPUT_SOURCE_ARRAY_SPIKES: int = 100000  # Max spikes to record per population (for SpikeSourceArray)
    
    # Sandbox Configuration
    SANDBOX_TIMEOUT_SECONDS: float = 1.0
    SANDBOX_ALLOWED_MODULES: set[str] = {"math", "random", "time"}
    
    # Process Management
    PROCESS_STOP_TIMEOUT: float = 5.0  # Seconds to wait for graceful shutdown
    PROCESS_START_WAIT: float = 1.0    # Seconds to wait after starting process
    
    # Paths
    WORK_DIR: Optional[Path] = None  # Will be set to temp dir if None
    CPP_RUNNER_DIR: Path = Path(__file__).parent.parent.parent / "cpp_runner"
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    @classmethod
    def get_work_dir(cls) -> Path:
        """Get or create work directory for GeNN models."""
        if cls.WORK_DIR is None:
            import tempfile
            cls.WORK_DIR = Path(tempfile.mkdtemp(prefix="genn_models_"))
        return cls.WORK_DIR


# Singleton config instance
config = Config()
