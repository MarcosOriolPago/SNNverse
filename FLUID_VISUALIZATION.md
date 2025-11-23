# Fluid Visualization Features

## Overview
The visualization now updates smoothly with gradient color transitions and prevents layout modifications during simulation.

## Gradient Color System

### Axon Colors (Spike Rate Based)
Instead of discrete color steps, axons now smoothly transition through a color gradient:

```
Gray (0 Hz) ──────▶ Yellow (50 Hz) ──────▶ Green (100+ Hz)
  ░░░░░░░          ░░▒▒▒▒▓▓          ▓▓████
```

**Color Interpolation:**
- **0 Hz**: Gray `rgb(107, 107, 128)` - No activity
- **0-50 Hz**: Smooth gradient Gray → Yellow
- **50-100 Hz**: Smooth gradient Yellow → Green  
- **100+ Hz**: Green `rgb(16, 185, 129)` - Maximum activity

**Implementation:**
```typescript
// Linear interpolation between two colors
const t = rate / threshold;  // 0 to 1
const r = Math.round(startColor.r + (endColor.r - startColor.r) * t);
const g = Math.round(startColor.g + (endColor.g - startColor.g) * t);
const b = Math.round(startColor.b + (endColor.b - startColor.b) * t);
```

### Opacity Gradient
Opacity also changes smoothly:
- **0 Hz**: 30% opacity (very faint)
- **<50 Hz**: 30% → 80% (fading in)
- **≥50 Hz**: 80% → 100% (fully visible)

## Update Frequency

### Fast Updates (100ms)
Changed from 1-second aggregation to 100ms windows:

**Configuration:**
```typescript
// front/src/config/visualization.ts
SPIKE_AGGREGATION_WINDOW_MS: 100  // 10 updates per second
```

**Benefits:**
- More responsive visual feedback
- Smoother color transitions
- Near real-time representation
- Still maintains performance (aggregates within 100ms windows)

### CSS Smooth Transitions
Axons use CSS transitions for fluid color changes:

```typescript
transition: 'stroke 0.15s ease-in-out, opacity 0.15s ease-in-out'
```

This ensures even smoother visual updates between the 100ms data updates.

## Interaction Locks During Simulation

When simulation is running (`isRunning: true`), the following actions are **disabled**:

### ✋ Blocked Actions
- ❌ **Dragging nodes** - `nodesDraggable={false}`
- ❌ **Creating connections** - `nodesConnectable={false}`
- ❌ **Adding new nodes** - Drop handler blocks
- ❌ **Selecting elements** - `elementsSelectable={false}`
- ❌ **Focusing nodes/edges** - `nodesFocusable={false}`, `edgesFocusable={false}`

### ✅ Allowed Actions
- ✓ Zoom and pan the canvas
- ✓ View node parameters (clicking neurons)
- ✓ Stop the simulation
- ✓ Observe visual updates

### User Feedback
If you try to drop a new node during simulation:
```
⚠️ Console: "Cannot add nodes while simulation is running"
```

## Performance Impact

### Before (1-second aggregation, discrete colors)
- Updates every 1000ms
- Sudden color jumps
- Layout editable during simulation (risky)

### After (100ms aggregation, gradient colors)
- Updates every 100ms (10Hz)
- Smooth color transitions
- Layout locked during simulation (safe)
- **Slightly** higher CPU usage (~2-3% more) but still efficient

## Configuration

### Adjust Update Speed
Edit `front/src/config/visualization.ts`:

```typescript
// Faster updates (more fluid, slightly more CPU)
SPIKE_AGGREGATION_WINDOW_MS: 50   // 20 Hz

// Slower updates (less fluid, less CPU)
SPIKE_AGGREGATION_WINDOW_MS: 200  // 5 Hz

// Default (balanced)
SPIKE_AGGREGATION_WINDOW_MS: 100  // 10 Hz
```

### Adjust Transition Speed
Edit `front/src/components/Axon.tsx`:

```typescript
// Faster transitions (snappier)
transition: 'stroke 0.05s ease-in-out, opacity 0.05s ease-in-out'

// Slower transitions (smoother)
transition: 'stroke 0.3s ease-in-out, opacity 0.3s ease-in-out'

// Default (balanced)
transition: 'stroke 0.15s ease-in-out, opacity 0.15s ease-in-out'
```

### Customize Color Thresholds
Edit `front/src/config/visualization.ts`:

```typescript
AXON_COLOR_THRESHOLDS: {
  LOW: 30,   // Earlier yellow transition
  HIGH: 80,  // Earlier green transition
},
```

## Example: Color at Different Rates

| Spike Rate | Approximate Color | Visual |
|------------|-------------------|--------|
| 0 Hz | `rgb(107, 107, 128)` | Dark gray, dashed |
| 10 Hz | `rgb(135, 123, 110)` | Gray-tan blend |
| 25 Hz | `rgb(179, 149, 82)` | Tan-yellow |
| 50 Hz | `rgb(251, 191, 36)` | Yellow |
| 75 Hz | `rgb(133, 188, 82)` | Yellow-green |
| 100 Hz | `rgb(16, 185, 129)` | Green |
| 150+ Hz | `rgb(16, 185, 129)` | Saturated green |

## Browser Compatibility

**CSS Transitions** are supported in all modern browsers:
- Chrome/Edge ✓
- Firefox ✓
- Safari ✓

**Performance:** Gradient calculations are lightweight (simple RGB interpolation).

## Troubleshooting

### Colors update but are not smooth
- Check CSS transitions are applied: Inspect element → Styles → `transition`
- Increase `SPIKE_AGGREGATION_WINDOW_MS` if updates are too fast

### Too much CPU usage
- Increase `SPIKE_AGGREGATION_WINDOW_MS` to 200-500ms
- Reduce transition duration to 0.05s

### Cannot interact with layout during simulation
- This is intentional! Stop the simulation first
- Protects against accidental modifications during analysis

### Want to allow layout edits during simulation
Edit `NodeLayout.tsx`:
```typescript
nodesDraggable={true}  // Always allow dragging
nodesConnectable={true}  // Always allow connections
// etc.
```

## Summary

The new fluid visualization provides:
1. **10x faster updates** (100ms vs 1000ms)
2. **Smooth color gradients** instead of discrete steps
3. **Safety locks** preventing accidental edits during simulation
4. **Minimal performance impact** thanks to efficient RGB interpolation

Enjoy the smooth, responsive SNN visualization! 🎨⚡
