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

    @staticmethod
    def autodiscover():
        """Auto-import modules in the 'types' subpackage to trigger registration."""
        from . import types
        for _, name, _ in pkgutil.iter_modules(types.__path__):
            importlib.import_module(f'.types.{name}', package=__package__)