import os
import subprocess
import numpy as np
import resource
import threading
import logging
from typing import Dict, Any, Tuple, Optional
from pathlib import Path
from pygenn import GeNNModel, init_weight_update, init_postsynaptic, SynapseMatrixType
from .config import config
from .database import get_db_manager, DatabaseManager
from .models import Network, User
from .artifact_storage import (
    get_model_archiver,
    get_storage_client,
    ModelArchiver,
    ArtifactStorageClient,
)

logger = logging.getLogger(__name__)

# Process-level singleton lock to prevent concurrent GeNN builds
_build_lock = threading.Lock()
_environment_verified = False


def verify_environment() -> None:
    """
    Verify that environment variables are set correctly before any GeNN operations.
    Sets LD_LIBRARY_PATH and GENN_PATH as needed.
    """
    global _environment_verified
    
    if _environment_verified:
        return
    
    try:
        # Ensure GENN_PATH is set
        genn_path = os.getenv("GENN_PATH")
        if not genn_path:
            # Try common locations
            for potential_path in [
                "/usr/local/genn",
                "/opt/genn",
                os.path.expanduser("~/genn"),
                "/home/marcos/marcos/snns/SNNverse/back/genn"
            ]:
                if os.path.exists(potential_path):
                    genn_path = potential_path
                    break
            
            if genn_path:
                os.environ["GENN_PATH"] = genn_path
                logger.info(f"Set GENN_PATH={genn_path}")
        
        # Ensure LD_LIBRARY_PATH includes GeNN libraries
        ld_path = os.getenv("LD_LIBRARY_PATH", "")
        genn_lib = os.path.join(genn_path, "lib") if genn_path else None
        
        if genn_lib and genn_lib not in ld_path:
            os.environ["LD_LIBRARY_PATH"] = f"{genn_lib}:{ld_path}"
            logger.info(f"Updated LD_LIBRARY_PATH to include {genn_lib}")
        
        _environment_verified = True
        logger.info("✓ Environment variables verified")
    
    except Exception as e:
        logger.error(f"Failed to verify environment: {e}")


def set_unlimited_stack() -> None:
    """Set stack size to unlimited for safe C++ generation."""
    try:
        # Get current limits
        soft, hard = resource.getrlimit(resource.RLIMIT_STACK)
        logger.info(f"Current stack limit: soft={soft}, hard={hard}")
        
        # Set to unlimited (hard limit max on this system)
        resource.setrlimit(resource.RLIMIT_STACK, (resource.RLIM_INFINITY, hard))
        logger.info("✓ Stack limit set to unlimited")
    except Exception as e:
        logger.warning(f"Could not set unlimited stack: {e}")


class GeNNNetworkBuilder:
    """
    Architect class that converts Frontend JSON -> Compiled GeNN C++ Model.
    
    Features:
    - Integrated database support (PostgreSQL)
    - Artifact storage (S3/MinIO)
    - Warm-start escalation logic
    - Thread-safe build operations
    - Environment verification
    """
    
    def __init__(
        self,
        work_dir: str = None,
        backend: str = "auto",
        model_id: str = None,
        network_id: str = None,
        user_id: str = None,
        db_manager: Optional[DatabaseManager] = None,
    ):
        # Initialize environment
        verify_environment()
        set_unlimited_stack()
        
        self.model_id = model_id or "user_network"
        self.work_dir = work_dir or str(config.get_work_dir())
        self.backend = self._select_backend(backend)
        
        # Database integration
        self.network_id = network_id
        self.user_id = user_id
        self.db_manager = db_manager or get_db_manager()
        
        # Artifact storage
        self.archiver = get_model_archiver()
        self.storage_client = get_storage_client()
        
        # State
        self.model = None
        self.neuron_populations = {}  # Map: node_id -> GeNN Population
        self.code_path = None
        self.model_sha = None
        self._current_buffer_size = None
        
        # Ensure output directory exists
        Path(self.work_dir).mkdir(parents=True, exist_ok=True)

    def is_compiled(self) -> bool:
        """Check if the model is already compiled."""
        runner_path = os.path.join(self.work_dir, f"{self.model_id}_CODE", "build", "network_runner")
        return os.path.exists(runner_path)

    def build_from_json(
        self,
        network_payload: Dict[str, Any],
        skip_compile: bool = False,
        save_to_db: bool = True,
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Main Entry Point: Builds the network from JSON with database & artifact integration.
        
        Args:
            network_payload: Frontend network config (nodes, edges)
            skip_compile: Use cached binary if available
            save_to_db: Save network metadata and compiled artifacts to database
        
        Returns:
            Tuple of (code_path, metadata_dict)
        """
        # Thread-safe build operation
        with _build_lock:
            return self._build_from_json_impl(network_payload, skip_compile, save_to_db)
    
    def _build_from_json_impl(
        self,
        network_payload: Dict[str, Any],
        skip_compile: bool = False,
        save_to_db: bool = True,
    ) -> Tuple[str, Dict[str, Any]]:
        """Internal implementation of build_from_json (called within lock)."""
        
        nodes = network_payload.get("nodes", [])
        edges = network_payload.get("edges", [])
        
        # Initialize GeNN Model
        self.model = GeNNModel("float", self.model_id, backend=self.backend)
        self.model.dt = config.DEFAULT_DT  # 0.1ms timestep
        
        print(f"Building Model '{self.model_id}' on backend: {self.backend}")

        # Build Populations (Nodes)
        for node in nodes:
            self._build_node(node)
            
        # Build Connections (Edges)
        for edge in edges:
            self._build_edge(edge)

        # Generate C++ Code
        self.code_path = os.path.join(self.work_dir, f"{self.model_id}_CODE")
        os.makedirs(self.code_path, exist_ok=True)
        cwd = os.getcwd()
        os.chdir(self.work_dir)  # GeNN requires cwd to be the build dir
        
        try:
            if not skip_compile:
                print("  Generating and compiling C++ code...")
                try:
                    self.model.build()
                except Exception as e:
                    print(f"ERROR during GeNN model.build(): {e}")
                    import traceback
                    traceback.print_exc()
                    raise RuntimeError(f"Failed to compile GeNN model: {str(e)}") from e
            else:
                print("  Skipping compilation (using cached binary).")
            
            # Compute model SHA for content verification
            self.model_sha = self.archiver.compute_model_sha(self.code_path)
            print(f"  Model SHA256: {self.model_sha}")
            
            # Archive compiled model for storage
            print("  Archiving compiled model...")
            zip_path, model_sha = self.archiver.archive_model(self.code_path)
            
            # Upload to artifact storage
            print("  Uploading artifact to storage...")
            compiled_code_url = None
            if self.network_id:
                try:
                    compiled_code_url = self.storage_client.upload_model(
                        zip_path, str(self.network_id), model_sha
                    )
                    print(f"  ✓ Artifact URL: {compiled_code_url}")
                except Exception as e:
                    print(f"  ⚠ Artifact upload failed (continuing): {e}")
                    compiled_code_url = f"file://{zip_path}"
            
            # Save network metadata to database
            if save_to_db and self.network_id and self.user_id:
                self._save_network_to_db(
                    network_payload, compiled_code_url, model_sha
                )
            
            return self.code_path, self._get_model_metadata()
        
        finally:
            os.chdir(cwd)

    def load_model(self, num_recording_timesteps: int = 1):
        """Loads the compiled C++ model into memory."""
        if not self.model:
            raise RuntimeError("Model has not been defined. Call build_from_json first.")
        
        # REMOVED: The check "if self._current_buffer_size == ..." 
        # REASON: We MUST call load() to reset 't' to 0.0.
        
        print(f"Loading DLL (Buffer: {num_recording_timesteps} steps)...")
        cwd = os.getcwd()
        os.chdir(self.work_dir)
        try:
            self.model.load(num_recording_timesteps=num_recording_timesteps)
            self._current_buffer_size = num_recording_timesteps
        finally:
            os.chdir(cwd)
    
    def warm_start_from_db(
        self, network_id: str, user_id: str, num_recording_timesteps: int = 1
    ) -> bool:
        """
        Escalation on Demand: Warm-start from precompiled artifact.
        
        When a simulation is triggered on a new container instance:
        1. Check if compiled_code_url exists for the model_sha
        2. Download and extract the zip to /tmp/genn_models
        3. Load the precompiled runner directly
        
        Args:
            network_id: UUID of the network to load
            user_id: UUID of the user
            num_recording_timesteps: Number of timesteps to record
        
        Returns:
            True if warm-start succeeded, False if full build needed
        """
        try:
            with self.db_manager.session_context() as session:
                # Query network from database
                network = (
                    session.query(Network)
                    .filter(Network.network_id == network_id, Network.user_id == user_id)
                    .first()
                )
                
                if not network:
                    logger.warning(f"Network {network_id} not found in database")
                    return False
                
                if not network.compiled_code_url:
                    logger.info(f"Network {network_id} has no compiled artifact")
                    return False
                
                logger.info(f"Attempting warm-start from {network.compiled_code_url}")
                
                # Download artifact from storage
                zip_path = os.path.join(self.work_dir, f"{network_id}_warm_start.zip")
                self.storage_client.download_model(network.compiled_code_url, zip_path)
                
                # Extract to work directory
                extract_dir = os.path.join(self.work_dir, f"{network_id}_CODE")
                self.archiver.extract_model(zip_path, extract_dir)
                
                # Verify model SHA matches
                extracted_sha = self.archiver.compute_model_sha(extract_dir)
                if network.model_sha and extracted_sha != network.model_sha:
                    logger.error(f"Model SHA mismatch: {extracted_sha} vs {network.model_sha}")
                    return False
                
                # Set code path for this builder instance
                self.code_path = extract_dir
                self.model_sha = network.model_sha
                
                # Initialize PyGeNN model with loaded binary
                # We need to load the precompiled binary directly
                self.model = GeNNModel("float", network_id, backend=network.backend_used)
                
                cwd = os.getcwd()
                os.chdir(self.work_dir)
                try:
                    self.model.load(num_recording_timesteps=num_recording_timesteps)
                    self._current_buffer_size = num_recording_timesteps
                    
                    logger.info("✓ Warm-start successful")
                    return True
                finally:
                    os.chdir(cwd)
        
        except Exception as e:
            logger.error(f"Warm-start failed: {e}")
            return False
    
    def _save_network_to_db(
        self,
        network_payload: Dict[str, Any],
        compiled_code_url: Optional[str],
        model_sha: str,
    ) -> None:
        """
        Save network metadata and compiled artifact location to database.
        
        Args:
            network_payload: Original network config
            compiled_code_url: S3/MinIO URL to compiled .zip
            model_sha: SHA256 hash of compiled model
        """
        try:
            with self.db_manager.session_context() as session:
                # Check if network already exists
                network = (
                    session.query(Network)
                    .filter_by(network_id=self.network_id)
                    .first()
                )
                
                if network:
                    # Update existing network
                    network.metadata_json = network_payload
                    network.compiled_code_url = compiled_code_url
                    network.model_sha = model_sha
                    network.backend_used = self.backend
                else:
                    # Create new network record
                    network = Network(
                        network_id=self.network_id,
                        user_id=self.user_id,
                        name=network_payload.get("name", self.model_id),
                        description=network_payload.get("description", ""),
                        metadata_json=network_payload,
                        compiled_code_url=compiled_code_url,
                        model_sha=model_sha,
                        backend_used=self.backend,
                        is_example=False,
                    )
                    session.add(network)
                
                session.commit()
                logger.info(f"Network {self.network_id} saved to database")
        
        except Exception as e:
            logger.error(f"Failed to save network to database: {e}")

    # --- Internal Builders ---

    def _build_node(self, node: Dict):
        """Dispatches node creation based on type."""
        node_id = self._sanitize_id(node["id"])
        node_type = node.get("type", "LIF").upper()
        params = node.get("params", {})
        
        if node_type == "LIF":
            pop = self._create_lif_neuron(node_id, params)
        elif node_type == "IZHIKEVICH":
            pop = self._create_izhikevich_neuron(node_id, params)
        elif node_type == "SPIKE_FX":
            print("Creating SpikeSourceArray input for node:", node_id)
            pop = self._create_spike_source_array_input(node_id)
        elif node_type in ["INPUT", "KEYBOARD"]:
            pop = self._create_input_neuron(node_id)
        else:
            print(f"Unknown node type '{node_type}', defaulting to LIF")
            pop = self._create_lif_neuron(node_id, params)
            
        self.neuron_populations[node["id"]] = pop

    def _build_edge(self, edge: Dict):
        source = edge["source"]
        target = edge["target"]
        
        if source not in self.neuron_populations or target not in self.neuron_populations:
            print(f"Skipping broken edge {source} -> {target}")
            return

        edge_id = f"syn_{self._sanitize_id(source)}_to_{self._sanitize_id(target)}"
        
        # Default Weights & Delays (Could be parameterized from edge dict)
        weight = 5.0 
        
        self.model.add_synapse_population(
            edge_id,
            SynapseMatrixType.DENSE,
            self.neuron_populations[source],
            self.neuron_populations[target],
            init_weight_update("StaticPulse", {}, {"g": weight}),
            init_postsynaptic("ExpCurr", {"tau": 5.0}, {})
        )

    # --- Neuron Models ---

    def _create_lif_neuron(self, name: str, p: Dict):
        # Map frontend params to GeNN params (Order matters!)
        lif_params = {
            "C": p.get("capacitance", 1.0),
            "TauM": p.get("tau", 20.0),
            "Vrest": p.get("rest", -70.0),
            "Vreset": p.get("reset", -70.0),
            "Vthresh": p.get("threshold", -55.0),
            "Ioffset": p.get("ioffset", 0.0),
            "TauRefrac": p.get("tau_refrac", 2.0)
        }
        lif_init = {"V": lif_params["Vrest"], "RefracTime": 0.0}
        
        pop = self.model.add_neuron_population(name, 1, "LIF", lif_params, lif_init)
        pop.spike_recording_enabled = True
        pop.vars["V"].recording_enabled = True  # Enable voltage recording
        return pop

    def _create_izhikevich_neuron(self, name: str, p: Dict):
        izh_params = {
            "a": p.get("a", 0.02), "b": p.get("b", 0.2), 
            "c": p.get("c", -65.0), "d": p.get("d", 8.0)
        }
        izh_init = {"V": -65.0, "U": izh_params["b"] * -65.0}
        
        pop = self.model.add_neuron_population(name, 1, "Izhikevich", izh_params, izh_init)
        pop.spike_recording_enabled = True
        pop.vars["V"].recording_enabled = True  # Enable voltage recording
        return pop

    def _create_input_neuron(self, name: str):
        """
        Creates an input neuron with normal LIF dynamics.
        Uses standard threshold so spikes are properly recorded by GeNN.
        External stimulation achieved via current injection.
        """
        input_params = {
            "C": 1.0, "TauM": 1.0, "Vrest": -70.0, "Vreset": -70.0,
            "Vthresh": -55.0,  # Normal threshold for proper spike detection
            "Ioffset": 0.0, "TauRefrac": 0.5  # Short refractory period
        }
        pop = self.model.add_neuron_population(
            name, 1, "LIF", input_params, {"V": -70.0, "RefracTime": 0.0}
        )
        pop.spike_recording_enabled = True
        pop.vars["V"].recording_enabled = True  # Enable voltage recording
        return pop
    
    def _create_spike_source_array_input(self, name: str):
        pop = self.model.add_neuron_population(
            name, 1, "SpikeSourceArray", 
            {}, 
            {"startSpike": [0], "endSpike": [0]} # Placeholder init
        )
        pop.extra_global_params["spikeTimes"].set_init_values(
            np.zeros(config.MAX_INPUT_SOURCE_ARRAY_SPIKES, dtype=float)
        )
        pop.spike_recording_enabled = True 
        return pop

    # --- Helpers ---

    def _sanitize_id(self, text: str) -> str:
        return "".join(c if c.isalnum() else "_" for c in text)

    def _select_backend(self, choice: str) -> str:
        if choice == "auto":
            # Simple check: does nvidia-smi exist?
            try:
                subprocess.run(['nvidia-smi'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return "cuda"
            except FileNotFoundError:
                return "single_threaded_cpu"
        return choice if choice != "cpu" else "single_threaded_cpu"

    def _get_model_metadata(self):
        return {
            "name": self.model_id,
            "code_path": self.code_path,
            "backend": self.backend,
            "model_sha": self.model_sha,
            "node_count": len(self.neuron_populations),
            "network_id": str(self.network_id) if self.network_id else None,
        }