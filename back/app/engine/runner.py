import asyncio
import torch
from spikingjelly.activation_based import neuron, functional, layer
import numpy as np

class SimulationRunner:
    def __init__(self, sio):
        self.sio = sio          # Socket.IO server instance
        self.net = None         # The SpikingJelly network
        self.running = False    # Simulation state flag
        self.task = None        # The asyncio task
        self.params = {}        # Simulation params (dt, duration, etc.)
        self.state_cache = {}   # To store current voltages

    def load_network(self, network_config: dict):
        """
        Parses frontend JSON config and builds SpikingJelly network.
        (Simplified example)
        """
        self.running = False
        # Example: A simple Sequential net
        # In reality, use a Builder pattern here to parse complex topologies
        self.net = torch.nn.Sequential(
            layer.Linear(10, 100),
            neuron.LIFNode(tau=2.0, v_threshold=1.0),
            layer.Linear(100, 10),
            neuron.LIFNode(tau=2.0, v_threshold=1.0)
        )
        functional.set_step_mode(self.net, 'step')
        print("Network Loaded")

    async def start(self):
        if self.net is None:
            raise ValueError("No network loaded")
        
        if not self.running:
            self.running = True
            # Run the loop in the background without blocking the server
            self.task = asyncio.create_task(self._loop())

    def stop(self):
        self.running = False
        if self.task:
            self.task.cancel()

    async def _loop(self):
        """The Main Physics Loop"""
        print("Simulation Loop Started")
        try:
            while self.running:
                # 1. Generate Input (or receive from external source)
                # Shape: [Batch, Input_Size]
                x = torch.rand(1, 10) 

                # 2. Physics Step (SpikingJelly)
                # We assume the net returns spikes or we hook into layers
                output = self.net(x)

                # 3. Extract Data for Frontend
                # This is the hard part: getting internal states (voltages)
                # You might need to iterate through self.net.modules()
                
                neuron_updates = []
                spikes = []

                # Example: extracting state from the first LIFNode layer
                # (You would iterate your actual layers here)
                for i, module in enumerate(self.net.modules()):
                    if isinstance(module, neuron.LIFNode):
                        # Get voltage (detach from graph for speed)
                        v = module.v.detach().cpu().numpy().flatten()
                        s = module.surrogate_function(module.v).detach().cpu().numpy().flatten()
                        
                        # Optimizing bandwidth: Only send necessary data
                        # Map internal index to Frontend ID
                        for idx, val in enumerate(v):
                            neuron_id = f"layer_{i}_neuron_{idx}"
                            neuron_updates.append({
                                "id": neuron_id,
                                "voltage": f"{val:.2f}mV"
                            })
                            
                            # Check for spike (assuming threshold 1.0 for demo)
                            if val >= 1.0: 
                                spikes.append(neuron_id)

                # 4. Emit (The heartbeat)
                await self.sio.emit('tick', {
                    'neurons': neuron_updates, 
                    'spikes': spikes,
                    'step': functional.get_step_mode(self.net) # or simulation step count
                })

                # 5. Yield control (Critical for async)
                # Adjust sleep time to control simulation speed
                await asyncio.sleep(0.05) 

        except asyncio.CancelledError:
            print("Simulation Stopped")
        except Exception as e:
            print(f"Simulation Error: {e}")
            self.running = False