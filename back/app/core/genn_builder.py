import os
import subprocess
import numpy as np
from typing import Dict, Any, Tuple
from pathlib import Path
from pygenn import GeNNModel, init_weight_update, init_postsynaptic, SynapseMatrixType
from .config import config


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
        self.keyboard_maps = {}  # Map: node_id -> key mapping dict
        self.code_path = None
        self._current_buffer_size = None
        
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
        self.model.dt = config.DEFAULT_DT # 0.1ms timestep
        
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
        elif node_type == "INPUT":
            pop = self._create_input_neuron(node_id)
        elif node_type == "KEYBOARD":
            key_map = params.get("keyMap", {})
            self.keyboard_maps[node_id] = key_map
            for key_char in key_map.keys():
                safe_key = self._sanitize_id(self._normalize_key_name(key_char))
                sub_pop_name = f"{node_id}_{safe_key}"
                print(f"Creating sub-population: {sub_pop_name}")
                pop = self._create_input_neuron(sub_pop_name)
                self.neuron_populations[sub_pop_name] = pop
        else:
            print(f"Unknown node type '{node_type}', defaulting to LIF")
            pop = self._create_lif_neuron(node_id, params)
            
        if node_id not in self.neuron_populations:
            self.neuron_populations[node_id] = pop

    def _build_edge(self, edge: Dict):
        source = self._sanitize_id(edge["source"])
        target = self._sanitize_id(edge["target"])
 
        # Physics Parameters
        params = edge.get("params", {})
        weight = float(params.get("weight", 50.0))  
        delay_ms = float(params.get("delay", 0.0))
        tau = float(params.get("tau", 5.0))

        # --- INSERT THESE DEBUG PRINTS ---
        print(f"\n[DEBUG] Building Edge: {source} -> {target}")
        print(f"[DEBUG]   Params -> Weight: {weight}, Delay: {delay_ms}, Tau: {tau}")
        print(f"[DEBUG]   Is Source a Keyboard? {'Yes' if source in self.keyboard_maps else 'No'}")
        if source in self.keyboard_maps:
            print(f"[DEBUG]   KeyMap for source: {self.keyboard_maps[source]}")
        # ---------------------------------

        if source in self.keyboard_maps:
            key_map = self.keyboard_maps[source]
            
            # --- INSERT ADDITIONAL LOGIC CHECK ---
            # This helps see if the target matching is failing due to timestamps
            print(f"[DEBUG]   Scanning KeyMap for target match '{target}'...")
            # -------------------------------------

            relevant_keys = [k for k, t in key_map.items() if self._sanitize_id(t) == target]
            
            # --- INSERT RESULT CHECK ---
            print(f"[DEBUG]   Found matching keys: {relevant_keys}")
            if not relevant_keys:
                 print(f"[DEBUG]   WARNING: Source is keyboard, but no key mapped to target '{target}' found!")
            # ---------------------------

            for key_char in relevant_keys:
                safe_key = self._sanitize_id(self._normalize_key_name(key_char))
                real_source_id = f"{source}_{safe_key}"
                print(f"Creating synapse for keyboard input: {real_source_id} -> {target}")
                self._create_synapse(real_source_id, target, weight, delay_ms, tau)
                
        else:
            self._create_synapse(source, target, weight, delay_ms, tau)

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

    def _create_synapse(self, source_id, target_id, weight, delay_ms, tau):
        if source_id not in self.neuron_populations or target_id not in self.neuron_populations:
            print(f"Skipping broken edge {source_id} -> {target_id}")
            return

        edge_id = f"syn_{source_id}_to_{target_id}"
        
        # Calculate steps
        delay_steps = int(round(delay_ms / self.model.dt))
        if delay_steps < 0: delay_steps = 0
        
        syn_pop = self.model.add_synapse_population(
            edge_id,
            SynapseMatrixType.DENSE,
            self.neuron_populations[source_id],
            self.neuron_populations[target_id],
            init_weight_update("StaticPulse", {}, {"g": weight}),
            init_postsynaptic("ExpCurr", {"tau": tau}, {})
        )
        
        if delay_steps > 0:
            syn_pop.max_dendritic_delay_timesteps = delay_steps

    # --- Helpers ---

    def _sanitize_id(self, text: str) -> str:
        return "".join(c if c.isalnum() else "_" for c in text)

    def _normalize_key_name(self, key) -> str:
        """Convert pynput key object to normalized string representation."""
        try:
            if hasattr(key, 'char') and key.char is not None:
                return key.char
            
            # Handle Special Keys explicitly
            k_str = str(key)

            if k_str == 'Key.space':
                return 'Space'  # Map to what your frontend expects
            elif k_str == 'Key.enter':
                return 'Enter'
            elif k_str == 'Key.up':
                return 'ArrowUp'
            elif k_str == 'Key.down':
                return 'ArrowDown'
            elif k_str == 'Key.left':
                return 'ArrowLeft'
            elif k_str == 'Key.right':
                return 'ArrowRight'
            elif k_str == 'Key.shift':
                return 'Shift'
            elif k_str == 'Key.alt':
                return 'Alt'
            elif k_str == 'Key.backspace':
                return 'Backspace'
            elif k_str == 'Key.tab':
                return 'Tab'
            elif k_str == 'Key.esc':
                return 'Escape'
            
            return k_str
            
        except AttributeError:
            return str(key)

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