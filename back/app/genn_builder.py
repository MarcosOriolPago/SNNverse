"""
GeNN Model Builder Module

This module handles Phase 1 (Definition) of the workflow:
- Receives network JSON from frontend
- Builds GeNN model description using pygenn
- Calls model.build() to generate C++ code
"""

import os
import tempfile
import json
from typing import Dict, List, Any, Tuple
from pathlib import Path
import numpy as np

# Import pygenn - ensure it's installed
try:
    from pygenn import (
        GeNNModel,
        init_weight_update,
        init_postsynaptic,
        init_var,
        init_sparse_connectivity,
        SynapseMatrixType
    )
    GENN_AVAILABLE = True
except ImportError:
    GENN_AVAILABLE = False
    print("WARNING: pygenn not available. Install with: pip install pygenn")


class GeNNNetworkBuilder:
    """
    Converts user-defined network from JSON to GeNN model description.
    This is the Architect that draws the blueprints.
    """
    
    def __init__(self, work_dir: str = None, backend: str = "auto"):
        """
        Initialize the builder.
        
        Args:
            work_dir: Directory where GeNN will generate C++ code.
                     If None, uses a temporary directory.
            backend: Backend to use ('auto', 'cuda', 'cpu'). 
                    'auto' will detect CUDA availability.
        """
        if not GENN_AVAILABLE:
            raise RuntimeError("pygenn is not installed. Cannot build GeNN models.")
        
        self.work_dir = work_dir or tempfile.mkdtemp(prefix="genn_models_")
        self.model = None
        self.neuron_populations = {}  # Maps node_id -> NeuronGroup
        self.synapse_populations = {}  # Maps edge_id -> SynapseGroup
        self.code_path = None  # Path to generated C++ code
        self.backend = self._select_backend(backend)
    
    def _select_backend(self, backend_choice: str) -> str:
        """
        Select appropriate backend based on user choice and system capabilities.
        
        Args:
            backend_choice: 'auto', 'cuda', 'cpu', or 'single_threaded_cpu'
            
        Returns:
            Backend string to pass to GeNN
        """
        if backend_choice == "auto":
            # Try to detect CUDA availability
            try:
                import subprocess
                result = subprocess.run(['nvidia-smi'], 
                                      stdout=subprocess.PIPE, 
                                      stderr=subprocess.PIPE,
                                      timeout=2)
                if result.returncode == 0:
                    print("✓ CUDA detected, using GPU backend")
                    return "cuda"
            except (FileNotFoundError, subprocess.TimeoutExpired):
                pass
            
            # Check environment variable for CPU-only mode
            if os.environ.get('GENN_CPU_ONLY') == '1':
                print("⚙ GENN_CPU_ONLY=1, using CPU backend")
                return "single_threaded_cpu"
            
            # Default to CPU if CUDA not found
            print("⚙ CUDA not available, using CPU backend")
            return "single_threaded_cpu"
        elif backend_choice in ["cpu", "single_threaded_cpu"]:
            return "single_threaded_cpu"
        elif backend_choice == "cuda":
            return "cuda"
        else:
            raise ValueError(f"Unknown backend: {backend_choice}")
        
    def build_from_json(self, network_payload: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """
        Build GeNN model from network JSON payload.
        
        Args:
            network_payload: Dictionary with 'nodes' and 'edges' keys
            
        Returns:
            Tuple of (code_directory_path, model_info_dict)
        """
        nodes = network_payload.get("nodes", [])
        edges = network_payload.get("edges", [])
        
        # Create GeNN model with float precision and selected backend
        model_name = "user_network"
        self.model = GeNNModel("float", model_name, backend=self.backend)
        self.model.dt = 0.1  # 0.1ms timestep
        
        print(f"Using backend: {self.backend}")
        
        # Phase 1: Add neuron populations
        self._add_neuron_populations(nodes)
        
        # Phase 2: Add synapse populations (connections)
        self._add_synapse_populations(edges)
        
        # Phase 3: Build the model (generates C++ code)
        print(f"Building GeNN model '{model_name}' in {self.work_dir}")
        os.chdir(self.work_dir)  # GeNN generates code in current directory
        self.model.build()
        
        # Path to generated code
        self.code_path = os.path.join(self.work_dir, f"{model_name}_CODE")
        
        # Export backend metadata for C++ runner
        self._export_backend_metadata()
        
        # NOTE: We use the pre-compiled standalone runner (genn_streaming_runner.cpp)
        # not a custom generated runner. The standalone runner loads the compiled
        # GeNN model dynamically via librunner.so
        
        model_info = {
            "model_name": model_name,
            "work_dir": self.work_dir,
            "code_path": self.code_path,
            "num_neurons": len(self.neuron_populations),
            "num_synapses": len(self.synapse_populations),
            "dt": self.model.dt,
            "neuron_ids": list(self.neuron_populations.keys()),
            "backend": self.backend
        }
        
        print(f"✓ Model built successfully. Generated code at: {self.code_path}")
        print(f"✓ Backend: {self.backend}")
        return self.code_path, model_info
        
    def _add_neuron_populations(self, nodes: List[Dict[str, Any]]):
        """
        Add neuron populations to GeNN model.
        Converts frontend node definitions to GeNN neuron populations.
        """
        for node in nodes:
            node_id = node["id"]
            node_type = node["type"]
            params = node.get("params", {})
            
            # Determine neuron model based on node type
            if node_type == "LIF":
                neuron_pop = self._create_lif_neuron(node_id, params)
            elif node_type == "IZHIKEVICH":
                neuron_pop = self._create_izhikevich_neuron(node_id, params)
            elif node_type == "PYTHON":
                # For custom Python nodes, we'll use a simple neuron model
                # The custom logic will be handled separately
                neuron_pop = self._create_input_neuron(node_id, params)
            else:
                # Default to simple LIF
                neuron_pop = self._create_lif_neuron(node_id, params)
            
            self.neuron_populations[node_id] = neuron_pop
            
    def _create_lif_neuron(self, node_id: str, params: Dict[str, Any]):
        """
        Create a Leaky Integrate-and-Fire neuron population.
        
        GeNN's LIF model requires 7 parameters:
        C, TauM, Vrest, Vreset, Vthresh, Ioffset, TauRefrac
        """
        # Extract parameters with defaults
        threshold = float(params.get("threshold", -55.0))
        reset_voltage = float(params.get("reset", -70.0))
        tau = float(params.get("tau", 20.0))  # membrane time constant (ms)
        rest = float(params.get("rest", -70.0))
        capacitance = float(params.get("capacitance", 1.0))  # nF
        offset_current = float(params.get("ioffset", 0.0))  # nA
        tau_refrac = float(params.get("tau_refrac", 2.0))  # refractory period (ms)
        
        # GeNN's LIF model expects these 7 parameters in order:
        # C, TauM, Vrest, Vreset, Vthresh, Ioffset, TauRefrac
        lif_params = {
            "C": capacitance,
            "TauM": tau,
            "Vrest": rest,
            "Vreset": reset_voltage,
            "Vthresh": threshold,
            "Ioffset": offset_current,
            "TauRefrac": tau_refrac
        }
        
        # Initial variable values: V (voltage), RefracTime
        lif_init = {
            "V": rest,
            "RefracTime": 0.0
        }
        
        # Add population (single neuron for now, can be extended)
        pop = self.model.add_neuron_population(
            node_id,
            1,  # Number of neurons (one per node)
            "LIF",  # Built-in LIF model
            lif_params,
            lif_init
        )
        
        # Enable spike recording for this population
        pop.spike_recording_enabled = True
        
        return pop
        
    def _create_izhikevich_neuron(self, node_id: str, params: Dict[str, Any]):
        """
        Create an Izhikevich neuron population.
        
        Izhikevich model: v' = 0.04v^2 + 5v + 140 - u + I
                         u' = a(bv - u)
                         if v >= 30: v = c, u = u + d
        """
        # Extract Izhikevich parameters with defaults
        a = float(params.get("a", 0.02))
        b = float(params.get("b", 0.2))
        c = float(params.get("c", -65.0))
        d = float(params.get("d", 8.0))
        
        # GeNN has built-in Izhikevich model
        izh_params = {
            "a": a,
            "b": b,
            "c": c,
            "d": d
        }
        
        izh_init = {
            "V": -65.0,
            "U": b * -65.0
        }
        
        pop = self.model.add_neuron_population(
            node_id,
            1,
            "Izhikevich",  # Built-in Izhikevich model
            izh_params,
            izh_init
        )
        
        # Enable spike recording for this population
        pop.spike_recording_enabled = True
        
        return pop
        
    def _create_input_neuron(self, node_id: str, params: Dict[str, Any]):
        """
        Create an input neuron (for custom Python functions or spike sources).
        
        For now, use a simple spike source array or poisson input.
        Custom Python logic will be handled by injecting currents.
        """
        # Use SpikeSourceArray for controlled input
        # We'll need to populate spike times later
        spike_times = np.array([], dtype=np.float32)
        
        pop = self.model.add_neuron_population(
            node_id,
            1,
            "SpikeSourceArray",
            {},
            {"startSpike": np.array([0], dtype=np.uint32),
             "endSpike": np.array([0], dtype=np.uint32)}
        )
        
        # Set initial spike times (empty for now)
        pop.extra_global_params["spikeTimes"].set_init_values(spike_times)
        
        # Enable spike recording for this population
        pop.spike_recording_enabled = True
        
        return pop
        
    def _add_synapse_populations(self, edges: List[Dict[str, Any]]):
        """
        Add synapse populations (connections) to GeNN model.
        """
        for i, edge in enumerate(edges):
            source_id = edge["source"]
            target_id = edge["target"]
            
            # Get source and target populations
            if source_id not in self.neuron_populations:
                print(f"Warning: Source neuron {source_id} not found for edge")
                continue
            if target_id not in self.neuron_populations:
                print(f"Warning: Target neuron {target_id} not found for edge")
                continue
                
            source_pop = self.neuron_populations[source_id]
            target_pop = self.neuron_populations[target_id]
            
            # Create synapse population with simple static weight
            edge_id = f"syn_{source_id}_to_{target_id}_{i}"
            
            # Use static pulse weight update model
            weight = 5.0  # Default synaptic weight (can be parameterized)
            
            wu_params = {}
            wu_vars = {"g": weight}  # Synaptic weight
            
            # Use exponential current-based postsynaptic model
            psm_params = {"tau": 5.0}  # Synaptic time constant
            psm_vars = {}
            
            syn_pop = self.model.add_synapse_population(
                edge_id,
                SynapseMatrixType.DENSE,  # Dense connectivity (1-to-1)
                source_pop,
                target_pop,
                init_weight_update("StaticPulse", wu_params, wu_vars),
                init_postsynaptic("ExpCurr", psm_params, psm_vars)
            )
            
            self.synapse_populations[edge_id] = syn_pop
    
    def _export_backend_metadata(self):
        """
        Export backend information to a JSON file for the C++ runner.
        This allows the runner to adapt its behavior based on the backend.
        """
        if self.code_path is None:
            return
        
        metadata = {
            "backend": self.backend,
            "backend_type": "gpu" if self.backend in ["cuda", "hip"] else "cpu",
            "requires_device_sync": self.backend in ["cuda", "hip"]
        }
        
        metadata_path = os.path.join(self.code_path, "backend_info.json")
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"✓ Backend metadata exported to: {metadata_path}")
    
    def _generate_custom_runner(self, nodes: List[Dict[str, Any]]):
        """
        Generate a custom C++ runner from template with model-specific code.
        This runner will be compiled together with the GeNN model.
        """
        if self.code_path is None:
            return
        
        print("Generating custom runner...")
        
        # Read runner template
        template_path = Path(__file__).parent.parent / "cpp_runner" / "runner_template.cpp"
        with open(template_path, 'r') as f:
            template = f.read()
        
        # Generate neuron metadata JSON
        neuron_metadata = {
            "neurons": [
                {"id": node["id"], "name": node["id"], "size": 1}
                for node in nodes
            ]
        }
        metadata_json = json.dumps(neuron_metadata)
        
        # Generate state variable declarations
        state_vars_code = []
        allocate_vars_code = []
        push_vars_code = []
        emit_code = []
        
        for node in nodes:
            node_id = node["id"]
            node_type = node.get("type", "LIF")
            
            # Determine state variables based on neuron type
            if node_type == "LIF":
                state_vars_code.append(f"float* {node_id}_V;")
                state_vars_code.append(f"float* {node_id}_RefracTime;")
                
                allocate_vars_code.append(f"{node_id}_V = new float[1];")
                allocate_vars_code.append(f"{node_id}_RefracTime = new float[1];")
                allocate_vars_code.append(f"{node_id}_V[0] = -70.0f;")
                allocate_vars_code.append(f"{node_id}_RefracTime[0] = 0.0f;")
                
                push_vars_code.append(
                    f"pushMergedNeuronUpdateGroup0ToDevice(0, {node_id}_RefracTime, {node_id}_V);"
                )
                push_vars_code.append(
                    f"pushMergedNeuronInitGroup0ToDevice(0, {node_id}_RefracTime, {node_id}_V);"
                )
                
                emit_code.append(
                    f'neurons.push_back({{{{"id", "{node_id}"}}, {{"v", {node_id}_V[0]}}}});'
                )
            
            elif node_type == "IZHIKEVICH":
                state_vars_code.append(f"float* {node_id}_V;")
                state_vars_code.append(f"float* {node_id}_U;")
                
                allocate_vars_code.append(f"{node_id}_V = new float[1];")
                allocate_vars_code.append(f"{node_id}_U = new float[1];")
                allocate_vars_code.append(f"{node_id}_V[0] = -65.0f;")
                allocate_vars_code.append(f"{node_id}_U[0] = -13.0f;")
                
                emit_code.append(
                    f'neurons.push_back({{{{"id", "{node_id}"}}, {{"v", {node_id}_V[0]}}}});'
                )
        
        # Add pull state code for GPU
        pull_state_code = ""
        if self.backend in ["cuda", "hip"]:
            pull_state_code = "pullStateFromDevice();"
        
        # Replace placeholders in template
        runner_code = template.replace("{NEURON_METADATA_JSON}", metadata_json)
        runner_code = runner_code.replace(
            "// {TEMPLATE_STATE_VARS}",
            "\n    ".join(state_vars_code) if state_vars_code else "// No state variables"
        )
        runner_code = runner_code.replace(
            "// {TEMPLATE_ALLOCATE_VARS}",
            "\n        ".join(allocate_vars_code) if allocate_vars_code else "// No allocations"
        )
        runner_code = runner_code.replace(
            "// {TEMPLATE_PUSH_VARS}",
            "\n        ".join(push_vars_code) if push_vars_code else "// No push needed"
        )
        runner_code = runner_code.replace(
            "// {TEMPLATE_PULL_STATE}",
            pull_state_code
        )
        runner_code = runner_code.replace(
            "// {TEMPLATE_EMIT_CODE}",
            "\n        ".join(emit_code) if emit_code else "// No neurons"
        )
        
        # Write customized runner
        runner_path = os.path.join(self.code_path, "runner.cpp")
        with open(runner_path, 'w') as f:
            f.write(runner_code)
        
        # Generate CMakeLists.txt
        self._generate_cmake()
        
        # Compile runner
        self._compile_runner()
        
        print(f"✓ Custom runner generated and compiled")
    
    def _generate_cmake(self):
        """Generate CMakeLists.txt for compiling the runner with GeNN model."""
        # Find system include paths
        cpp_runner_dir = Path(__file__).parent.parent / "cpp_runner"
        
        cmake_content = f"""cmake_minimum_required(VERSION 3.10)
project(genn_network_runner)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# GeNN paths
set(GENN_PATH $ENV{{GENN_PATH}})
if(NOT GENN_PATH)
    set(GENN_PATH "/opt/genn")
endif()

# Find required packages
find_package(Threads REQUIRED)

# Include directories
include_directories(
    ${{CMAKE_CURRENT_SOURCE_DIR}}
    ${{GENN_PATH}}/include
    /usr/include
    /usr/local/include
)

# Source files
set(GENN_SOURCES
    init.cc
    neuronUpdate.cc
    synapseUpdate.cc
    customUpdate.cc
    runner.cc
)

set(RUNNER_SOURCES
    runner.cpp
)

# Compile runner executable
add_executable(network_runner
    ${{RUNNER_SOURCES}}
    ${{GENN_SOURCES}}
)

# Link libraries
target_link_libraries(network_runner
    Threads::Threads
    pthread
    dl
)

# Compiler flags
target_compile_options(network_runner PRIVATE
    -O3
    -march=native
    -ffast-math
)
"""
        
        cmake_path = os.path.join(self.code_path, "CMakeLists.txt")
        with open(cmake_path, 'w') as f:
            f.write(cmake_content)
    
    def _compile_runner(self):
        """Compile the custom runner."""
        import subprocess
        
        build_dir = os.path.join(self.code_path, "build")
        os.makedirs(build_dir, exist_ok=True)
        
        print("  Configuring CMake...")
        result = subprocess.run(
            ["cmake", ".."],
            cwd=build_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        if result.returncode != 0:
            print(f"  ✗ CMake configuration failed:")
            print(result.stderr)
            return
        
        print("  Building runner...")
        result = subprocess.run(
            ["make", "-j4"],
            cwd=build_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        if result.returncode != 0:
            print(f"  ✗ Build failed:")
            print(result.stderr)
            return
        
        print(f"  ✓ Runner compiled: {build_dir}/network_runner")
            
    def load_model(self):
        """
        Load the built model into memory.
        This must be called after build_from_json() and before simulation.
        """
        if self.model is None:
            raise RuntimeError("Model not built yet. Call build_from_json() first.")
        
        if self.code_path is None:
            raise RuntimeError("Model not built yet. Code path is None.")
        
        print("Loading GeNN model into memory...")
        # Change to the directory where the model was built
        original_dir = os.getcwd()
        try:
            os.chdir(self.work_dir)
            self.model.load()
            print("✓ Model loaded successfully.")
        finally:
            os.chdir(original_dir)
        
    def get_model(self):
        """Return the GeNN model instance."""
        return self.model
        
    def get_neuron_populations(self) -> Dict[str, Any]:
        """Return dictionary of neuron populations."""
        return self.neuron_populations
        
    def cleanup(self):
        """Clean up temporary files if needed."""
        # GeNN generates a lot of files, but we might want to keep them
        # for debugging or compilation
        pass


# Example usage
if __name__ == "__main__":
    # Test network payload
    test_payload = {
        "nodes": [
            {"id": "neuron1", "type": "LIF", "params": {"threshold": -55.0, "tau": 20.0}},
            {"id": "neuron2", "type": "IZHIKEVICH", "params": {"a": 0.02, "b": 0.2}},
            {"id": "input1", "type": "PYTHON", "params": {}}
        ],
        "edges": [
            {"source": "neuron1", "target": "neuron2"},
            {"source": "input1", "target": "neuron1"}
        ]
    }
    
    # Build model
    builder = GeNNNetworkBuilder()
    code_path, info = builder.build_from_json(test_payload)
    
    print("\nModel Info:")
    for key, value in info.items():
        print(f"  {key}: {value}")
