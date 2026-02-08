import importlib
import pkgutil
from typing import Dict, Type, List
from .base import InputAdapter

class InputRegistry:
    """
    Central registry for all input adapter types.
    Allows for auto-discovery and instantiation by string name.
    """
    _inputs: Dict[str, Type[InputAdapter]] = {}

    @classmethod
    def register(cls, name: str):
        """Decorator to register an input class."""
        def wrapper(wrapped_class: Type[InputAdapter]):
            cls._inputs[name] = wrapped_class
            return wrapped_class
        return wrapper

    @classmethod
    def get_adapter_class(cls, name: str) -> Type[InputAdapter]:
        return cls._inputs.get(name)

    @classmethod
    def list_available(cls) -> List[str]:
        return list(cls._inputs.keys())
    
    @classmethod
    def create_from_node(cls, node: dict) -> InputAdapter:
        """
        Factory method to create an input adapter from a node configuration.
        This enables modular input handling without if/elif chains.
        
        Args:
            node: Node dictionary with 'type', 'id', and 'params'
            
        Returns:
            Instantiated InputAdapter or None if node type not supported
        """
        node_type = node.get("type", "").lower()
        node_id = node["id"]
        params = node.get("params", {})
        
        # Map node types to input adapter names
        type_mapping = {
            "spike_fx": "spike_fx",
            "keyboard": "keyboard",
            "serial": "serial_sensor",
        }
        
        adapter_name = type_mapping.get(node_type)
        if not adapter_name:
            return None
            
        adapter_class = cls.get_adapter_class(adapter_name)
        if not adapter_class:
            print(f"[InputRegistry] Warning: Adapter '{adapter_name}' not registered")
            return None
        
        # Create adapter based on type
        try:
            if adapter_name == "spike_fx":
                # Python script input
                code = params.get("code") or params.get("custom_function", "")
                if not code:
                    return None
                    
                freq_hz = float(params.get("frequency", 100.0))
                
                return adapter_class(
                    code=code,
                    target_ids=[node_id],
                    frequency=freq_hz
                )
                
            elif adapter_name == "keyboard":
                # Keyboard input
                key_map = params.get("keyMap", {})
                if not key_map:
                    print(f"[InputRegistry] Warning: No key mappings for keyboard node '{node_id}'")
                    return None
                    
                return adapter_class(key_map=key_map)
                
            elif adapter_name == "serial_sensor":
                # Serial input
                config = {
                    "port": params.get("port", "/dev/ttyUSB0"),
                    "baud": params.get("baud", 9600),
                    "code": params.get("code", ""),
                    "targets": params.get("targets", [node_id])
                }
                return adapter_class(config=config)
                
        except Exception as e:
            print(f"[InputRegistry] Error creating adapter for node '{node_id}': {e}")
            return None

    @staticmethod
    def autodiscover():
        """Auto-import modules in the 'types' subpackage to trigger registration."""
        from . import types
        for _, name, _ in pkgutil.iter_modules(types.__path__):
            importlib.import_module(f'.types.{name}', package=__package__)