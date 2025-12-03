import urllib.request
import urllib.error
import time
import json
import sys

BASE_URL = "http://localhost:8000"

def post_json(url, data=None):
    req = urllib.request.Request(
        url, 
        data=json.dumps(data).encode() if data else None,
        headers={'Content-Type': 'application/json'} if data else {},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def test_population_flow():
    print("1. Testing Population Build...")
    payload = {
        "nodes": [
            {"id": "pop1", "type": "LIF", "params": {"threshold": -55.0}, "size": 10},
            {"id": "input1", "type": "PYTHON", "params": {}, "size": 1}
        ],
        "edges": [
            {"source": "input1", "target": "pop1"}
        ]
    }
    
    start_time = time.time()
    status, data = post_json(f"{BASE_URL}/api/network/load_genn", payload)
    
    if status != 200:
        print(f"FAILED: {data}")
        sys.exit(1)
    
    print(f"✓ Build successful. Model info: {json.dumps(data['model_info'], indent=2)}")
    
    # Verify neuron count
    if data['model_info']['num_neurons'] != 2: # 2 populations
        print(f"WARNING: Expected 2 populations, got {data['model_info']['num_neurons']}")
    
    print("\n2. Testing Compilation Caching...")
    start_time_2 = time.time()
    status_2, data_2 = post_json(f"{BASE_URL}/api/network/load_genn", payload)
    duration_2 = time.time() - start_time_2
    
    if status_2 != 200:
        print(f"FAILED: {data_2}")
        sys.exit(1)
        
    print(f"✓ Second build took {duration_2:.2f}s (First took {time.time() - start_time:.2f}s)")
    if duration_2 > 2.0:
        print("WARNING: Caching might not be working (took > 2s)")
    else:
        print("✓ Caching seems to be working")

    print("\n3. Testing Simulation Start...")
    status, data = post_json(f"{BASE_URL}/api/simulation/start_genn")
    if status != 200:
        print(f"FAILED: {data}")
        sys.exit(1)
    print("✓ Simulation started")
    
    # Wait for runner to initialize
    time.sleep(2)
    
    print("\n4. Testing Input Injection (TCP)...")
    import socket
    
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect(('localhost', 9001))
        
        # Inject into pop1, index 5
        msg = json.dumps({
            "neuron_id": "pop1",
            "spike": True,
            "index": 5
        }) + "\n"
        sock.sendall(msg.encode())
        print("✓ Sent spike command to pop1[5]")
        
        time.sleep(1)
        sock.close()
        
    except Exception as e:
        print(f"FAILED to connect/send to TCP: {e}")
        sys.exit(1)

    print("\n5. Stopping Simulation...")
    post_json(f"{BASE_URL}/api/simulation/stop")
    print("✓ Simulation stopped")

if __name__ == "__main__":
    try:
        test_population_flow()
        print("\n✓ ALL TESTS PASSED")
    except Exception as e:
        print(f"\n✗ TEST FAILED: {e}")
        sys.exit(1)
