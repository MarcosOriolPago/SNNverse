# Performance Tuning Guide

Quick reference for optimizing SNNverse visualization based on network size.

## Recommended Settings by Network Size

### Small Networks (<100 neurons)
**Configuration:** Default settings
```typescript
// front/src/config/visualization.ts
USE_POLLING: false
SPIKE_AGGREGATION_WINDOW_MS: 1000
```
```python
# back/app/main.py
EMIT_EVERY_N_TICKS = 1  # No throttling needed
```
**Expected Performance:** Smooth, real-time visualization

---

### Medium Networks (100-500 neurons)
**Configuration:** Socket.io with throttling
```typescript
// front/src/config/visualization.ts
USE_POLLING: false
SPIKE_AGGREGATION_WINDOW_MS: 1000
```
```python
# back/app/main.py
EMIT_EVERY_N_TICKS = 2  # Emit every 2nd tick
```
**Expected Performance:** Smooth with slight reduction in visual fidelity

---

### Large Networks (500-1000 neurons)
**Configuration:** Polling mode recommended
```typescript
// front/src/config/visualization.ts
USE_POLLING: true
POLLING_INTERVAL_MS: 200
```
```python
# back/app/main.py
EMIT_EVERY_N_TICKS = 5  # Heavy throttling
```
**Expected Performance:** Stable, status-based visualization

---

### Very Large Networks (>1000 neurons)
**Configuration:** Aggressive polling + backend throttling
```typescript
// front/src/config/visualization.ts
USE_POLLING: true
POLLING_INTERVAL_MS: 500  // Poll every 500ms
```
```python
# back/app/main.py
EMIT_EVERY_N_TICKS = 10  # Maximum throttling
# Consider increasing sleep time in simulation loop:
await asyncio.sleep(0.1)  # From 0.05 to 0.1
```
**Expected Performance:** Delayed but stable visualization

---

## Troubleshooting

### Symptoms: Browser tab freezing
**Solution:**
1. Enable polling mode: `USE_POLLING: true`
2. Increase `POLLING_INTERVAL_MS` to 300-500ms
3. Increase backend `EMIT_EVERY_N_TICKS` to 5+

### Symptoms: Visualization lagging behind simulation
**Solution:**
1. Reduce `POLLING_INTERVAL_MS` (if in polling mode)
2. Reduce `EMIT_EVERY_N_TICKS` on backend
3. Check network latency (socket.io)

### Symptoms: Axons not changing color
**Solution:**
1. Check spike rates are being calculated (console logs)
2. Lower `AXON_COLOR_THRESHOLDS.LOW` if spike rates are low
3. Verify edges have unique IDs

### Symptoms: Memory usage increasing over time
**Solution:**
1. Ensure spike counters are being cleared (check `spikeCountsRef.current.clear()`)
2. Verify socket.io cleanup in useEffect return
3. Check for React component memory leaks with DevTools

---

## Monitoring Performance

### Browser DevTools
1. **Performance Tab**: Record during simulation to identify bottlenecks
2. **Memory Tab**: Check for memory leaks during long simulations
3. **Console**: Watch for spike rate calculations and event emissions

### Backend Logs
```python
# Add timing logs to simulation loop
import time
loop_start = time.time()
# ... simulation code ...
print(f"Loop time: {(time.time() - loop_start)*1000:.2f}ms")
```

### Key Metrics to Track
- **Frontend**: React component re-renders per second
- **Backend**: Simulation loop time (should be <50ms)
- **Network**: Socket.io event frequency
- **Browser**: JavaScript execution time in Performance tab

---

## Advanced Optimizations

### 1. Batch State Updates
Modify backend to accumulate multiple ticks before emitting:
```python
if tick_counter % EMIT_EVERY_N_TICKS == 0:
    await sio.emit('tick', accumulated_data)
    accumulated_data = reset_accumulator()
```

### 2. Differential Updates
Only send neurons with significant voltage changes:
```python
updates = [
    {"id": nid, "voltage": f"{v:.1f}mV"}
    for nid, v in neurons.items()
    if abs(v - previous_voltage[nid]) > THRESHOLD
]
```

### 3. WebSocket Binary Protocol
Replace JSON with MessagePack for smaller payloads:
```python
import msgpack
await sio.emit('tick', msgpack.packb(data))
```

### 4. Frontend Virtualization
For >1000 neurons, only render visible nodes:
```typescript
// Use react-flow's built-in viewport filtering
<ReactFlow
  onlyRenderVisibleElements={true}  // ReactFlow optimization
  nodes={nodes}
  edges={edges}
/>
```
