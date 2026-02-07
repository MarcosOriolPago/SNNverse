import hashlib
import json
from typing import Dict, Any, Optional, List
from ..genn_builder import GeNNNetworkBuilder
from ...api.schemas import NetworkPayload

class ModelService:
    def __init__(self):
        self.current_builder: Optional[GeNNNetworkBuilder] = None
        self.network_config: Optional[Dict[str, Any]] = None
        self.model_info: Optional[Dict[str, Any]] = None

    def calculate_hash(self, network_dict: Dict[str, Any]) -> str:
        network_str = json.dumps(network_dict, sort_keys=True)
        return hashlib.md5(network_str.encode()).hexdigest()

    def load_network(self, payload: NetworkPayload) -> Dict[str, Any]:
        print(f"Loading network: {len(payload.nodes)} nodes")
        
        # Store Config
        self.network_config = {
            "nodes": [node.dict() for node in payload.nodes],
            "edges": [edge.dict() for edge in payload.edges]
        }
        
        # Compile/Load
        model_hash = self.calculate_hash(self.network_config)
        self.current_builder = GeNNNetworkBuilder(model_id=model_hash)
        
        if self.current_builder.is_compiled():
            print(f"✓ Using cached model: {model_hash}")
            _, self.model_info = self.current_builder.build_from_json(self.network_config, skip_compile=True)
        else:
            print("Building new GeNN model...")
            _, self.model_info = self.current_builder.build_from_json(self.network_config)
        
        return self.model_info

    def get_nodes(self) -> List[Dict]:
        return self.network_config.get("nodes", []) if self.network_config else []