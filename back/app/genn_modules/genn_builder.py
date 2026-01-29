import os
import subprocess
from typing import Dict, List, Any, Tuple
from pathlib import Path
from pygenn import GeNNModel, init_weight_update, init_postsynaptic, SynapseMatrixType
from ..core.config import config


class GeNNNetworkBuilder:
    """
    Architect class that converts Frontend JSON -> Compiled GeNN C++ Model.
    """
    
    def __init__(self, work_dir: str = None, backend: str = "auto", model_id: str = None):
        self.model_id = model_id or "user_network"
        self.work_dir = work_dir or str(config.get_work_dir())
        self.backend = self._select_backend(backend)
        
        # State
        self.model = None
        self.neuron_populations = {}  # Map: node_id -> GeNN Population
        self.code_path = None
        
        # Ensure output directory exists
        Path(self.work_dir).mkdir(parents=True, exist_ok=True)

    def is_compiled(self) -> bool:
        """Check if the model is already compiled."""
        runner_path = os.path.join(self.work_dir, f"{self.model_id}_CODE", "build", "network_runner")
        return os.path.exists(runner_path)

    def build_from_json(self, network_payload: Dict[str, Any], skip_compile: bool = False) -> Tuple[str, Dict[str, Any]]:
        """
        Main Entry Point: Builds the network from JSON.
        """
        nodes = network_payload.get("nodes", [])
        edges = network_payload.get("edges", [])
        
        # Initialize GeNN Model
        self.model = GeNNModel("float", self.model_id, backend=self.backend)
        self.model.dt = 0.1 # Fixed dt for stability
        
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
        os.chdir(self.work_dir) # GeNN requires cwd to be the build dir
        
        if not skip_compile:
            print("  Generating and compiling C++ code...")
            self.model.build()
        else:
            print("  Skipping compilation (using cached binary).")

        return self.code_path, self._get_model_metadata()

    def load_model(self, num_recording_timesteps: int = 1):
        """Loads the compiled C++ model into memory for execution."""
        if not self.model:
            raise RuntimeError("Model has not been defined. Call build_from_json first.")
            
        print(f"Loading model (Buffer: {num_recording_timesteps} steps)...")
        # Critical: GeNN loads shared libraries from the current working directory
        cwd = os.getcwd()
        os.chdir(self.work_dir)
        try:
            self.model.load(num_recording_timesteps=num_recording_timesteps)
        finally:
            os.chdir(cwd)

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
        elif node_type in ["PYTHON", "INPUT"]:
            # CRITICAL CHANGE: We now create actual populations for inputs
            # This allows them to have outgoing synapses with weights/delays.
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
        return pop

    def _create_izhikevich_neuron(self, name: str, p: Dict):
        izh_params = {
            "a": p.get("a", 0.02), "b": p.get("b", 0.2), 
            "c": p.get("c", -65.0), "d": p.get("d", 8.0)
        }
        izh_init = {"V": -65.0, "U": izh_params["b"] * -65.0}
        
        pop = self.model.add_neuron_population(name, 1, "Izhikevich", izh_params, izh_init)
        pop.spike_recording_enabled = True
        return pop

    def _create_input_neuron(self, name: str):
        """
        Creates a 'Silent' neuron that only fires when forced by the InputAdapter.
        Threshold is set impossibly high so it never fires naturally.
        """
        silent_params = {
            "C": 1.0, "TauM": 1.0, "Vrest": -70.0, "Vreset": -70.0,
            "Vthresh": 10000.0, # <--- Impossible threshold
            "Ioffset": 0.0, "TauRefrac": 0.0
        }
        return self.model.add_neuron_population(
            name, 1, "LIF", silent_params, {"V": -70.0, "RefracTime": 0.0}
        )

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
            "node_count": len(self.neuron_populations)
        }