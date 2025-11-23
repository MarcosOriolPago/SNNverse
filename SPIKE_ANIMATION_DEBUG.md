# Spike Animation Debugging Guide

## Changes Made

### 1. More Visible Spike Animation
- **Color**: Changed to cyan (`#22d3ee`) - much brighter
- **Size**: Increased from 3px to 5px radius
- **Stroke**: Added white 2px stroke for better visibility
- **Opacity**: Set to 1 (fully opaque)

### 2. Configurable Speed
You can now adjust spike animation speed by modifying `defaultEdgeOptions` in `NodeLayout.tsx`:

```typescript
const defaultEdgeOptions = {
  type: 'spike',
  markerEnd: 'edge-circle',
  style: { ... },
  data: {
    spikeSpeed: 0.6, // seconds - ADJUST THIS for speed
    spikeSize: 5,    // pixels - ADJUST THIS for size
  },
};
```

**Speed recommendations:**
- `0.3` - Fast (good for short connections)
- `0.6` - Default (balanced)
- `1.0` - Slow (good for long connections, easier to see)
- `2.0` - Very slow (for debugging)

### 3. Debug Logging
Added console logs to track spike flow:

**Backend** (`back/app/main.py`):
```
⚡ Emitting spikes: ['node-id-123']
```

**Frontend** (`NodeLayout.tsx`):
```
⚡ Spikes received from backend: ['node-id-123']
  → Emitting spike for node: node-id-123
```

**Frontend** (`Axon.tsx`):
```
🔥 Axon firing! Source: node-id-123
```

## Testing Steps

### 1. Start Backend
```bash
cd back
source .venv/bin/activate
python run.py
```

### 2. Start Frontend
```bash
cd front
npm run dev
```

### 3. Open Browser Console
- Press F12 or right-click → Inspect
- Go to "Console" tab
- Keep this open to see debug messages

### 4. Create Test Network
1. Drag an **Input** node onto canvas
2. Drag a **Neuron** node onto canvas
3. Connect Input → Neuron (draw edge)

### 5. Test Custom Function
Click the Code button on Input node and use this test function:
```python
def spike_function(t, ctx):
    # Spike every 0.5 seconds for easy testing
    return int(t * 2) % 2 == 0
```

Click RUN to verify it works (should show ⚡ SPIKE or ○ No Spike)

### 6. Run Simulation
Click the **Run** button (top-right)

### 7. Check Console Output
You should see:
```
⚡ Spikes received from backend: ['input-node-id']
  → Emitting spike for node: input-node-id
🔥 Axon firing! Source: input-node-id
```

### 8. Observe Animation
You should see a **bright cyan circle** traveling along the edge every 0.5 seconds

## Troubleshooting

### No spikes in console?
**Problem**: Backend isn't generating spikes
**Solutions**:
1. Check backend console for errors
2. Verify your function returns `True` (not "True" or 1)
3. Try simple test: `def spike_function(t, ctx): return True`

### Spikes in backend but not frontend?
**Problem**: Socket.IO connection issue
**Solutions**:
1. Check browser console for WebSocket errors
2. Verify backend is running on `http://localhost:8000`
3. Check CORS settings in backend

### Spikes received but no animation?
**Problem**: Edge not subscribed or node ID mismatch
**Solutions**:
1. Verify edge has `source` that matches spiking node ID
2. Check console: "Axon firing!" should appear
3. Try disconnecting and reconnecting the edge

### Animation too fast/slow?
**Solution**: Adjust `spikeSpeed` in `NodeLayout.tsx`:
```typescript
data: {
  spikeSpeed: 1.0, // Increase for slower, decrease for faster
}
```

### Can't see animation?
**Problem**: Might be too small or wrong color
**Solutions**:
1. Increase `spikeSize` in `NodeLayout.tsx`
2. Try different colors in `Axon.tsx` (line 52)
3. Zoom in on the canvas

## Example Functions for Testing

### Always Spike (easiest test)
```python
def spike_function(t, ctx):
    return True
```
Expected: Continuous animation every simulation step

### Periodic Spike
```python
def spike_function(t, ctx):
    # Spike every second
    return int(t) % 2 == 0
```
Expected: Animation every 1 second

### Random Spike
```python
def spike_function(t, ctx):
    import random
    return random.random() < 0.3
```
Expected: Animation ~30% of the time (random)

### Burst Pattern
```python
def spike_function(t, ctx):
    # Spike 5 times, pause, repeat
    cycle = int(t) % 10
    return cycle < 5
```
Expected: 5 animations, pause, repeat

## Performance Tips

1. **Too many spikes**: If simulation slows down, reduce spike frequency
2. **Speed**: Faster animations (0.3s) work better for high-frequency spikes
3. **Size**: Larger spikes (7-10px) easier to see but more GPU intensive

## Advanced: Per-Edge Speed Configuration

You can set different speeds for different edges:

```typescript
// When creating edge programmatically
const newEdge = {
  id: 'edge-1',
  source: 'node-1',
  target: 'node-2',
  type: 'spike',
  data: {
    spikeSpeed: 1.5, // This edge is slower
    spikeSize: 8,    // This edge has bigger spikes
  },
};
```

## Files Modified

- `back/app/main.py` - Added spike emission logging
- `front/src/components/Axon.tsx` - Made animation more visible, added speed control
- `front/src/components/NodeLayout.tsx` - Added spike reception logging, speed config
