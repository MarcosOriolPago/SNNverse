"""
Standalone Offline Simulation Pipeline Test

Tests the complete path: NetworkConfig → Builder → Runtime → SessionStore → VoltageRead

Run inside the backend container:
    docker exec -it SpikeVerse-backend python -m pytest back/tests/test_offline_pipeline.py -v

Or directly:
    cd back && python tests/test_offline_pipeline.py
"""
import sys
import os
import struct

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.types import NetworkConfig, NodeConfig, EdgeConfig
from app.core.builder import GeNNBuilder
from app.core.runtime import OfflineRuntime
from app.core.manager import SimulationManager


def make_single_lif_network() -> NetworkConfig:
    """1 LIF neuron with no inputs."""
    return NetworkConfig(
        nodes=[NodeConfig(id="lif_a", type="LIF")],
        edges=[],
        name="test_single_lif",
    )


def make_spike_to_two_lif_network() -> NetworkConfig:
    """1 SpikeSourceArray → 2 LIF neurons (the failed multi-neuron case)."""
    return NetworkConfig(
        nodes=[
            NodeConfig(
                id="spike_src",
                type="SPIKE_FX",
                params={
                    "code": "def spike(t, ctx):\n    return t % 10 == 0\n",
                    "frequency": 1000.0,
                },
            ),
            NodeConfig(id="lif_a", type="LIF"),
            NodeConfig(id="lif_b", type="LIF"),
        ],
        edges=[
            EdgeConfig(source="spike_src", target="lif_a"),
            EdgeConfig(source="spike_src", target="lif_b"),
        ],
        name="test_spike_to_two_lif",
    )


def make_chain_network() -> NetworkConfig:
    """SpikeSourceArray → LIF A → LIF B (synapse chain)."""
    return NetworkConfig(
        nodes=[
            NodeConfig(
                id="spike_src",
                type="SPIKE_FX",
                params={
                    "code": "def spike(t, ctx):\n    return t % 20 == 0\n",
                    "frequency": 1000.0,
                },
            ),
            NodeConfig(id="lif_a", type="LIF"),
            NodeConfig(id="lif_b", type="LIF"),
        ],
        edges=[
            EdgeConfig(source="spike_src", target="lif_a"),
            EdgeConfig(source="lif_a", target="lif_b"),
        ],
        name="test_chain",
    )


def run_test(name: str, net: NetworkConfig, duration_ms: float = 100.0, dt: float = 1.0):
    """Run one test case and assert basic correctness."""
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"{'='*60}")

    manager = SimulationManager()

    # Convert to dicts for manager API
    nodes = [{"id": n.id, "type": n.type, "params": n.params} for n in net.nodes]
    edges = [{"source": e.source, "target": e.target, "data": e.data} for e in net.edges]

    # 1. Build
    import asyncio
    result = asyncio.run(manager.load_network(nodes, edges, net.name))
    assert result["status"] == "loaded", f"Build failed: {result}"
    print(f"✓ Build: {result['status']}")

    # 2. Run offline
    sim_result = manager.run_offline(duration_ms=duration_ms, dt=dt)
    assert "session_id" in sim_result, f"Missing session_id: {sim_result}"
    session_id = sim_result["session_id"]
    print(f"✓ Simulation: session={session_id[:8]}...")
    print(f"  Wall time: {sim_result['wall_time']:.2f}s")

    # 3. Check voltage file has correct number of frames
    session = manager.sessions[session_id]
    expected_steps = int(duration_ms / dt)
    file_size = os.path.getsize(session.file_path)
    frame_size = session.total_neurons * 4  # 4 bytes per float32

    if frame_size > 0:
        actual_frames = file_size // frame_size
        assert actual_frames == expected_steps, (
            f"Expected {expected_steps} frames, got {actual_frames} "
            f"(file={file_size}B, frame={frame_size}B)"
        )
        print(f"✓ Voltage file: {actual_frames}/{expected_steps} frames at {frame_size}B each")
    else:
        print(f"  (no voltage-recording populations in this network)")

    # 4. Check voltage values are sensible (not all zero, not NaN)
    if frame_size > 0 and actual_frames > 0:
        voltages = manager.get_voltages(session_id, 0, duration_ms)
        assert voltages, "No voltage frames returned"
        first_frame = voltages[0]
        for pop_name, vals in first_frame["voltages"].items():
            for v in vals:
                assert not (v != v), f"NaN voltage in {pop_name}"  # NaN check
        print(f"✓ Voltage values: {len(voltages)} frames, no NaN detected")

    # 5. Check spikes
    spike_data = sim_result.get("spike_data", {})
    print(f"  Spike summary:")
    for pop_name, spikes in spike_data.items():
        n = len(spikes.get("times", []))
        print(f"    {pop_name}: {n} spikes")

    print(f"\n✅ PASS: {name}")
    return True


if __name__ == "__main__":
    tests = [
        ("Single LIF (no input)", make_single_lif_network()),
        ("Spike → 2 LIF (multi-neuron)", make_spike_to_two_lif_network()),
        ("Spike → LIF A → LIF B (chain)", make_chain_network()),
    ]

    passed = 0
    failed = 0

    for test_name, network in tests:
        try:
            run_test(test_name, network)
            passed += 1
        except Exception as e:
            print(f"\n❌ FAIL: {test_name}: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print(f"\n\n{'='*60}")
    print(f"Results: {passed} passed, {failed} failed")
    print(f"{'='*60}")

    sys.exit(0 if failed == 0 else 1)
