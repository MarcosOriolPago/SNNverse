#!/usr/bin/env python3
import socket
import json
import time
import sys

HOST = "127.0.0.1"
PORT = 9003          # TCP port used by the C++ runner

def send_spike(neuron_id: str, spike: bool = True):
    payload = {"neuron_id": neuron_id, "spike": spike}
    data = json.dumps(payload) + "\n"   # newline terminates the message
    
    print(f"Connecting to {HOST}:{PORT}...")
    try:
        with socket.create_connection((HOST, PORT), timeout=2.0) as sock:
            sock.sendall(data.encode("utf-8"))
            print(f"Sent: {payload}")
    except ConnectionRefusedError:
        print(f"Error: Connection refused. Is the simulation running?")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        neuron_id = sys.argv[1]
    else:
        neuron_id = "input1"
        
    print(f"Injecting spike for neuron: {neuron_id}")
    send_spike(neuron_id, spike=True)
