
import asyncio
import sys
import os
import json
from pathlib import Path

# Add back/app to path
sys.path.append(os.path.join(os.getcwd(), 'back'))

from app.core.simulation_manager import simulation_manager
from app.api.schemas import NetworkPayload, Node, Edge

async def main():
    print("Loading network...")
    
    # Define a simple network
    payload = NetworkPayload(
        nodes=[
            Node(id="pop1", type="LIF", params={}, size=1, position={"x":0, "y":0})
        ],
        edges=[],
        network_name="TestNetwork"
    )
    
    try:
        await simulation_manager.load_network(payload)
        print("Network loaded.")
        
        print("Running offline simulation...")
        result = simulation_manager.run_offline(duration_ms=100.0, dt=1.0)
        
        print("Simulation complete.")
        print("Result keys:", result.keys())
        
        # Test serialization
        print("Testing JSON serialization...")
        json_str = json.dumps(result)
        print("Serialization successful.")
        print("JSON length:", len(json_str))
        
    except Exception as e:
        print(f"CRASH: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
