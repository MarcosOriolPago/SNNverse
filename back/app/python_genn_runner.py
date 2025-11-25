"""
Python GeNN Runner

Runs a GeNN model using PyGeNN and streams output via WebSocket.
Accepts input commands via TCP.

This replaces the C++ runner with a Python implementation that properly
interfaces with GeNN's Python bindings.
"""

import sys
import socket
import json
import select
import asyncio
import websockets
from threading import Thread, Lock
from queue import Queue, Empty
import time

# Import pygenn
from pygenn import GeNNModel


class PythonGeNNRunner:
    """
    Python-based GeNN model runner.
    
    - Loads GeNN model using PyGeNN
    - Accepts input via TCP (port 9001)
    - Streams output via WebSocket (port 9002)
    """
    
    def __init__(self, model_path: str, ws_port: int = 9002, tcp_port: int = 9001):
        self.model_path = model_path
        self.ws_port = ws_port
        self.tcp_port = tcp_port
        
        # GeNN model
        self.genn_model = None
        self.neuron_pops = {}
        self.neuron_metadata = []
        
        # TCP input server
        self.tcp_socket = None
        self.input_queue = Queue()
        self.running = True
        
        # WebSocket connections
        self.ws_clients = set()
        self.ws_lock = Lock()
        
        # Simulation state
        self.timestep = 0
        self.sim_time = 0.0
        self.dt = 0.1  # ms
        
    def load_model(self):
        """Load the GeNN model from the generated code."""
        print(f"📦 Loading model from: {self.model_path}")
        
        # Load metadata
        metadata_path = f"{self.model_path}/neuron_metadata.json"
        try:
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
                self.neuron_metadata = metadata["neurons"]
                print(f"✓ Loaded metadata: {len(self.neuron_metadata)} neurons")
        except FileNotFoundError:
            print(f"⚠️  Metadata not found: {metadata_path}")
            return False
        
        # Load GeNN model using pygenn
        # The model has already been built, we just need to load it
        try:
            self.genn_model = GeNNModel.load_model(self.model_path)
            print("✓ GeNN model loaded")
            
            # Get references to neuron populations
            for neuron_info in self.neuron_metadata:
                neuron_id = neuron_info["id"]
                if neuron_id in self.genn_model.neuron_populations:
                    self.neuron_pops[neuron_id] = self.genn_model.neuron_populations[neuron_id]
                    print(f"  ✓ {neuron_id}")
            
            # Allocate memory
            self.genn_model.allocate_mem()
            print("✓ Memory allocated")
            
            # Initialize
            self.genn_model.initialize()
            print("✓ Model initialized")
            
            return True
            
        except Exception as e:
            print(f"❌ Failed to load GeNN model: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def start_tcp_server(self):
        """Start TCP server for input commands."""
        try:
            self.tcp_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.tcp_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.tcp_socket.bind(('0.0.0.0', self.tcp_port))
            self.tcp_socket.listen(5)
            self.tcp_socket.setblocking(False)
            print(f"✓ TCP input server listening on port {self.tcp_port}")
            return True
        except Exception as e:
            print(f"❌ Failed to start TCP server: {e}")
            return False
    
    def tcp_accept_loop(self):
        """Accept TCP connections and handle input commands."""
        while self.running:
            try:
                # Non-blocking accept
                readable, _, _ = select.select([self.tcp_socket], [], [], 0.1)
                if readable:
                    client_socket, addr = self.tcp_socket.accept()
                    print(f"🔌 Input provider connected from {addr}")
                    
                    # Handle client in thread
                    thread = Thread(target=self.handle_tcp_client, args=(client_socket,))
                    thread.daemon = True
                    thread.start()
            except Exception as e:
                if self.running:
                    print(f"TCP accept error: {e}")
                    time.sleep(0.1)
    
    def handle_tcp_client(self, client_socket):
        """Handle a single TCP client connection."""
        buffer = ""
        client_socket.setblocking(False)
        
        while self.running:
            try:
                readable, _, _ = select.select([client_socket], [], [], 0.1)
                if readable:
                    data = client_socket.recv(4096).decode('utf-8')
                    if not data:
                        break  # Connection closed
                    
                    buffer += data
                    
                    # Process complete JSON messages (newline-delimited)
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        if line.strip():
                            try:
                                cmd = json.loads(line)
                                self.input_queue.put(cmd)
                            except json.JSONDecodeError as e:
                                print(f"JSON decode error: {e}")
            except socket.error:
                break
            except Exception as e:
                print(f"TCP client error: {e}")
                break
        
        client_socket.close()
        print("🔌 Input provider disconnected")
    
    def process_input_commands(self):
        """Process queued input commands."""
        while not self.input_queue.empty():
            try:
                cmd = self.input_queue.get_nowait()
                cmd_type = cmd.get("type", "")
                
                if cmd_type == "spike":
                    # Inject spike to neuron
                    neuron_id = cmd.get("neuron_id", "")
                    if neuron_id in self.neuron_pops:
                        # Set spike for this timestep
                        # This is model-specific, simplified for now
                        print(f"  spike -> {neuron_id}")
                
                elif cmd_type == "current":
                    # Inject current to neuron
                    neuron_id = cmd.get("neuron_id", "")
                    value = cmd.get("value", 0.0)
                    if neuron_id in self.neuron_pops:
                        # Set input current (model-specific)
                        print(f"  current -> {neuron_id}: {value}")
                
                elif cmd_type == "stop":
                    print("⏸️  Stop command received")
                    self.running = False
                    
            except Empty:
                break
    
    def run_simulation_step(self):
        """Run one simulation step."""
        # Process any pending input commands
        self.process_input_commands()
        
        # Step the simulation
        self.genn_model.step_time()
        self.timestep += 1
        self.sim_time = self.timestep * self.dt
        
        # Check for spikes
        spiked_ids = []
        for neuron_id, pop in self.neuron_pops.items():
            # Pull spike data
            pop.pull_current_spikes_from_device()
            if len(pop.current_spikes) > 0:
                spiked_ids.append(neuron_id)
        
        # Send spike events
        if spiked_ids:
            msg = {
                "type": "spike",
                "t": self.sim_time,
                "ids": spiked_ids
            }
            self.broadcast_ws(json.dumps(msg))
        
        # Send voltage updates (every 200 timesteps = 20ms)
        if self.timestep % 200 == 0:
            neurons = []
            for neuron_id, pop in self.neuron_pops.items():
                # Pull state variables
                pop.pull_state_from_device()
                v = pop.vars["V"].view[0]  # First neuron
                neurons.append({"id": neuron_id, "v": float(v)})
            
            msg = {
                "type": "voltage",
                "t": self.sim_time,
                "step": self.timestep,
                "neurons": neurons
            }
            self.broadcast_ws(json.dumps(msg))
    
    def broadcast_ws(self, message: str):
        """Broadcast message to all WebSocket clients."""
        with self.ws_lock:
            for client in list(self.ws_clients):
                try:
                    asyncio.create_task(client.send(message))
                except:
                    self.ws_clients.discard(client)
    
    async def ws_handler(self, websocket, path):
        """Handle WebSocket client connection."""
        with self.ws_lock:
            self.ws_clients.add(websocket)
        
        print(f"🔌 WebSocket client connected (total: {len(self.ws_clients)})")
        
        # Send metadata
        metadata_msg = {
            "type": "metadata",
            "dt": self.dt,
            "voltage_interval_ms": 20.0,
            "neurons": self.neuron_metadata
        }
        await websocket.send(json.dumps(metadata_msg))
        
        try:
            # Keep connection open
            async for message in websocket:
                # Handle control messages
                try:
                    cmd = json.loads(message)
                    action = cmd.get("action", "")
                    
                    if action == "ping":
                        await websocket.send(json.dumps({"type": "pong"}))
                    elif action == "stop":
                        print("⏸️  Stop from WebSocket")
                        self.running = False
                except:
                    pass
        finally:
            with self.ws_lock:
                self.ws_clients.discard(websocket)
            print(f"🔌 WebSocket client disconnected (total: {len(self.ws_clients)})")
    
    async def run_ws_server(self):
        """Run WebSocket server."""
        async with websockets.serve(self.ws_handler, "0.0.0.0", self.ws_port):
            print(f"✓ WebSocket server listening on port {self.ws_port}")
            while self.running:
                await asyncio.sleep(0.1)
    
    def run(self):
        """Main run loop."""
        print("═" * 55)
        print("  GeNN Python Runner (PUSH Mode)")
        print("═" * 55)
        print(f"🚀 GeNN Python Runner started")
        print(f"   WebSocket: port {self.ws_port}")
        print(f"   TCP Input: port {self.tcp_port}")
        print(f"   Mode: PUSH (continuous streaming)")
        
        # Load model
        if not self.load_model():
            sys.exit(1)
        
        # Start TCP server
        if not self.start_tcp_server():
            sys.exit(1)
        
        # Start TCP accept thread
        tcp_thread = Thread(target=self.tcp_accept_loop)
        tcp_thread.daemon = True
        tcp_thread.start()
        
        # Start WebSocket server in asyncio
        async def run_both():
            ws_task = asyncio.create_task(self.run_ws_server())
            
            # Run simulation loop
            while self.running:
                self.run_simulation_step()
                await asyncio.sleep(0.0001)  # 0.1ms
            
            ws_task.cancel()
        
        try:
            asyncio.run(run_both())
        except KeyboardInterrupt:
            print("\n⏹️  Shutting down...")
        finally:
            self.running = False
            if self.tcp_socket:
                self.tcp_socket.close()
        
        print("✓ Runner stopped")


def main():
    if len(sys.argv) < 3:
        print("Usage: python_genn_runner.py <model_path> <ws_port> [tcp_port]")
        sys.exit(1)
    
    model_path = sys.argv[1]
    ws_port = int(sys.argv[2])
    tcp_port = int(sys.argv[3]) if len(sys.argv) > 3 else 9001
    
    runner = PythonGeNNRunner(model_path, ws_port, tcp_port)
    runner.run()


if __name__ == "__main__":
    main()
