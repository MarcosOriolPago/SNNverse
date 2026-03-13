"""
GeNN Network Builder

Converts a NetworkConfig (frontend JSON) into a compiled GeNN C++ model.

Input:  NetworkConfig (list of NodeConfig + EdgeConfig)
Output: BuildResult (code_path, populations metadata)

This module encapsulates ALL GeNN-specific logic. No other module should 
import from pygenn directly.
"""

import os
import subprocess
import numpy as np
import resource
import threading
import logging
from typing import Dict, Any, Optional
from pathlib import Path

from pygenn import (
    GeNNModel,
    init_weight_update,
    init_postsynaptic,
    SynapseMatrixType,
)

from .config import config
from .types import NodeConfig, EdgeConfig, NetworkConfig, BuildResult, PopulationInfo

logger = logging.getLogger(__name__)

# ─── Process-level singleton ────────────────────────────────────────

_build_lock = threading.Lock()
_environment_verified = False


def _verify_environment() -> None:
    """Verify GeNN environment variables before any operations."""
    global _environment_verified
    if _environment_verified:
        return

    try:
        genn_path = os.getenv("GENN_PATH")
        if not genn_path:
            for candidate in [
                "/usr/local/genn",
                "/opt/genn",
                os.path.expanduser("~/genn"),
                "/home/marcos/marcos/snns/SpikeVerse/back/genn",
            ]:
                if os.path.exists(candidate):
                    genn_path = candidate
                    break
            if genn_path:
                os.environ["GENN_PATH"] = genn_path
                logger.info(f"Set GENN_PATH={genn_path}")

        ld_path = os.getenv("LD_LIBRARY_PATH", "")
        genn_lib = os.path.join(genn_path, "lib") if genn_path else None
        if genn_lib and genn_lib not in ld_path:
            os.environ["LD_LIBRARY_PATH"] = f"{genn_lib}:{ld_path}"

        _environment_verified = True
        logger.info("✓ GeNN environment verified")
    except Exception as e:
        logger.error(f"Failed to verify environment: {e}")


def _set_unlimited_stack() -> None:
    """Set stack size to unlimited for safe C++ generation."""
    try:
        _, hard = resource.getrlimit(resource.RLIMIT_STACK)
        resource.setrlimit(resource.RLIMIT_STACK, (resource.RLIM_INFINITY, hard))
    except Exception as e:
        logger.warning(f"Could not set unlimited stack: {e}")


# ─── Builder Class ──────────────────────────────────────────────────


class GeNNBuilder:
    """
    Builds and manages a GeNN model from a NetworkConfig.

    Usage:
        builder = GeNNBuilder(model_id="my_model")
        result = builder.build(network_config)
        builder.load(num_recording_timesteps=2000)
        # Now builder.model and builder.populations are ready for simulation
    """

    def __init__(self, model_id: str = "user_network", work_dir: str = None):
        _verify_environment()
        _set_unlimited_stack()

        self.model_id = model_id
        self.work_dir = work_dir or str(config.get_work_dir())
        self.backend = self._detect_backend()

        # State (populated after build)
        self.model = None                           # GeNNModel instance
        self.populations: Dict[str, Any] = {}       # {original_id: GeNN population}
        self.population_info: Dict[str, PopulationInfo] = {}  # {original_id: metadata}
        self.code_path: Optional[str] = None
        self._loaded = False

        Path(self.work_dir).mkdir(parents=True, exist_ok=True)

    # ─── Public API ────────────────────────────────────────────────

    def is_compiled(self) -> bool:
        """Check if a compiled binary already exists for this model_id."""
        runner = os.path.join(
            self.work_dir, f"{self.model_id}_CODE", "build", "network_runner"
        )
        return os.path.exists(runner)

    def build(self, net: NetworkConfig, skip_compile: bool = False) -> BuildResult:
        """
        Build (and optionally compile) a GeNN model from a NetworkConfig.

        Args:
            net: The network configuration with nodes and edges
            skip_compile: If True, skip C++ compilation (use cached binary)

        Returns:
            BuildResult with code_path and population metadata

        Thread-safe: only one build can run at a time.
        """
        with _build_lock:
            return self._build_impl(net, skip_compile)

    def load(self, num_recording_timesteps: int = 1) -> None:
        """
        Load the compiled model into memory (ready for stepping).

        Must be called after build(). Each call resets the model to t=0.

        Args:
            num_recording_timesteps: Recording buffer size for spike data
        """
        if not self.model:
            raise RuntimeError("No model built. Call build() first.")

        logger.info(f"Loading model (buffer={num_recording_timesteps} steps)...")
        cwd = os.getcwd()
        os.chdir(self.work_dir)
        try:
            self.model.load(num_recording_timesteps=num_recording_timesteps)
            self._loaded = True
        finally:
            os.chdir(cwd)

    # ─── Internal Build Logic ──────────────────────────────────────

    def _build_impl(self, net: NetworkConfig, skip_compile: bool) -> BuildResult:
        """Internal: constructs the GeNN model from config."""

        # Create fresh GeNN model
        self.model = GeNNModel("float", self.model_id, backend=self.backend)
        self.model.dt = config.DEFAULT_DT
        self.populations = {}
        self.population_info = {}

        logger.info(f"Building '{self.model_id}' on {self.backend} "
                     f"({len(net.nodes)} nodes, {len(net.edges)} edges)")

        # Build populations (nodes)
        for node in net.nodes:
            self._add_population(node)

        # Build synapses (edges)
        for edge in net.edges:
            self._add_synapse(edge)

        # Generate C++ code
        self.code_path = os.path.join(self.work_dir, f"{self.model_id}_CODE")
        os.makedirs(self.code_path, exist_ok=True)

        cwd = os.getcwd()
        os.chdir(self.work_dir)
        try:
            if not skip_compile:
                logger.info("Compiling C++ code...")
                try:
                    self.model.build()
                except Exception as e:
                    logger.error(f"GeNN compilation failed: {e}")
                    import traceback
                    traceback.print_exc()
                    raise RuntimeError(f"GeNN compilation failed: {e}") from e
            else:
                logger.info("Using cached compiled binary")
        finally:
            os.chdir(cwd)

        result = BuildResult(
            code_path=self.code_path,
            model_id=self.model_id,
            backend=self.backend,
            populations=dict(self.population_info),
        )
        logger.info(f"✓ Build complete: {len(self.populations)} populations")
        return result

    # ─── Population Builders ───────────────────────────────────────

    def _add_population(self, node: NodeConfig) -> None:
        """Create a GeNN neuron population from a NodeConfig."""
        safe_name = self._sanitize_id(node.id)
        node_type = node.type.upper()
        size = int(node.size) if node.size is not None else 1
        size = max(1, min(size, 65536))

        if node_type == "LIF":
            pop = self._make_lif(safe_name, node.params, size)
            has_v = True
        elif node_type == "IF":
            pop = self._make_if(safe_name, node.params, size)
            has_v = True
        elif node_type == "IZHIKEVICH":
            pop = self._make_izhikevich(safe_name, node.params, size)
            has_v = True
        elif node_type == "SPIKE_FX":
            pop = self._make_spike_source(safe_name)
            has_v = False
        elif node_type in ("INPUT", "KEYBOARD"):
            pop = self._make_input_lif(safe_name)
            has_v = True
        else:
            logger.warning(f"Unknown type '{node_type}' for node '{node.id}', defaulting to LIF")
            pop = self._make_lif(safe_name, node.params, size)
            has_v = True

        # Store population keyed by ORIGINAL id (for edge lookups)
        self.populations[node.id] = pop
        self.population_info[node.id] = PopulationInfo(
            name=safe_name,
            original_id=node.id,
            neuron_type=node_type,
            size=size,
            has_voltage=has_v,
            spike_recording=True,
        )

    def _add_synapse(self, edge: EdgeConfig) -> None:
        """Create a GeNN synapse between two populations."""
        if edge.source not in self.populations:
            logger.warning(f"Skipping edge: source '{edge.source}' not found")
            return
        if edge.target not in self.populations:
            logger.warning(f"Skipping edge: target '{edge.target}' not found")
            return

        src_safe = self._sanitize_id(edge.source)
        tgt_safe = self._sanitize_id(edge.target)
        syn_name = f"syn_{src_safe}_to_{tgt_safe}"

        weight = edge.data.get("weight", 5.0)

        self.model.add_synapse_population(
            syn_name,
            SynapseMatrixType.DENSE,
            self.populations[edge.source],
            self.populations[edge.target],
            init_weight_update("StaticPulse", {}, {"g": weight}),
            init_postsynaptic("ExpCurr", {"tau": 5.0}, {}),
        )

    # ─── Neuron Model Factories ────────────────────────────────────

    def _make_lif(self, name: str, params: Dict[str, Any], size: int = 1):
        """Create a Leaky Integrate-and-Fire population."""
        p = {
            "C": params.get("capacitance", 1.0),
            "TauM": params.get("tau", 20.0),
            "Vrest": params.get("rest", -70.0),
            "Vreset": params.get("reset", -70.0),
            "Vthresh": params.get("threshold", -55.0),
            "Ioffset": params.get("ioffset", 0.0),
            "TauRefrac": params.get("tau_refrac", 2.0),
        }
        init_vals = {"V": p["Vrest"], "RefracTime": 0.0}

        pop = self.model.add_neuron_population(name, size, "LIF", p, init_vals)
        pop.spike_recording_enabled = True
        return pop

    def _make_if(self, name: str, params: Dict[str, Any], size: int = 1):
        """Create an Integrate-and-Fire population (LIF with very large tau, no leak)."""
        p = {
            "C": params.get("capacitance", 1.0),
            "TauM": 10000.0,  # Very large tau → negligible leak (pure integration)
            "Vrest": params.get("rest", -70.0),
            "Vreset": params.get("reset", -70.0),
            "Vthresh": params.get("threshold", -55.0),
            "Ioffset": params.get("ioffset", 0.0),
            "TauRefrac": params.get("tau_refrac", 2.0),
        }
        init_vals = {"V": p["Vrest"], "RefracTime": 0.0}
        pop = self.model.add_neuron_population(name, size, "LIF", p, init_vals)
        pop.spike_recording_enabled = True
        return pop

    def _make_izhikevich(self, name: str, params: Dict[str, Any], size: int = 1):
        """Create an Izhikevich neuron population."""
        p = {
            "a": params.get("a", 0.02),
            "b": params.get("b", 0.2),
            "c": params.get("c", -65.0),
            "d": params.get("d", 8.0),
        }
        init_vals = {"V": -65.0, "U": p["b"] * -65.0}

        pop = self.model.add_neuron_population(name, size, "Izhikevich", p, init_vals)
        pop.spike_recording_enabled = True
        return pop

    def _make_input_lif(self, name: str):
        """Create an input neuron (LIF with fast dynamics for keyboard/serial)."""
        p = {
            "C": 1.0,
            "TauM": 1.0,
            "Vrest": -70.0,
            "Vreset": -70.0,
            "Vthresh": -55.0,
            "Ioffset": 0.0,
            "TauRefrac": 0.5,
        }
        pop = self.model.add_neuron_population(
            name, 1, "LIF", p, {"V": -70.0, "RefracTime": 0.0}
        )
        pop.spike_recording_enabled = True
        return pop

    def _make_spike_source(self, name: str):
        """Create a SpikeSourceArray population (for offline spike injection)."""
        pop = self.model.add_neuron_population(
            name, 1, "SpikeSourceArray",
            {},
            {"startSpike": [0], "endSpike": [0]},
        )
        pop.extra_global_params["spikeTimes"].set_init_values(
            np.zeros(config.MAX_INPUT_SOURCE_ARRAY_SPIKES, dtype=np.float32)
        )
        pop.spike_recording_enabled = True
        return pop

    # ─── Helpers ───────────────────────────────────────────────────

    @staticmethod
    def _sanitize_id(text: str) -> str:
        """Convert arbitrary string to valid C++ identifier."""
        return "".join(c if c.isalnum() else "_" for c in text)

    @staticmethod
    def _detect_backend() -> str:
        """Auto-detect CUDA or fall back to single-threaded CPU."""
        try:
            subprocess.run(
                ["nvidia-smi"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return "cuda"
        except FileNotFoundError:
            return "single_threaded_cpu"
