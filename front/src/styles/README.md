# Styles Organization

This directory contains all CSS stylesheets for the SNNverse frontend, organized by component and functionality.

## File Structure

### Components
- **`spike-rate-popup.css`** - Modern popup for real-time spike rate metrics
- **`neuron-node.css`** - Neuron node visualization styles
- **`input-node.css`** - Input node (Python generator) styles
- **`node-layout.css`** - Main canvas and ReactFlow container styles

### Layout & UI
- **`dashboard.css`** - Main dashboard layout
- **`sidebar.css`** - Left sidebar with node palette
- **`modal.css`** - Modal dialogs and overlays
- **`main-content.css`** - Main content area

### Utilities
- **`draggable.css`** - Drag and drop interactions
- **`lod-styles.css`** - Level of detail optimizations

## Style Guidelines

### Organization
Each CSS file should be organized with clear section headers:
```css
/* ========================================
   COMPONENT NAME
   ========================================
   Brief description
   ======================================== */

/* ----------------------------------------
   SECTION NAME
   ---------------------------------------- */
```

### Naming Conventions
- Use **kebab-case** for class names: `.spike-rate-popup`
- Use **BEM** for nested elements: `.popup-header`, `.popup-content`
- Prefix component-specific classes to avoid conflicts

### Comments
- Add section headers for major areas
- Comment complex calculations or non-obvious styles
- Document color values and their purpose

### Colors
Standard color palette:
- **Gray**: `#6b7280` (inactive)
- **Yellow**: `#fbbf24` (low activity)
- **Green**: `#10b981` (high activity)
- **Red**: `#ef4444` (alerts/peaks)
- **Dark BG**: `#111827` → `#1f2937` (gradients)

### Animations
- Use **ease-in-out** for smooth transitions
- Standard duration: `0.15s` for interactions, `0.2s` for entrances
- Always provide fallbacks for browsers without animation support

## Dynamic Styles

Some components require dynamic inline styles (calculated at runtime):
- **Axon.tsx**: Color/opacity gradients based on spike rate
- **SpikeRatePopup.tsx**: Position based on node location
- **NeuronNode.tsx**: Voltage-based heat colors

These are unavoidable and documented in the component files.

## Import Order

When importing CSS in components:
1. External libraries (e.g., `@xyflow/react`)
2. Global/shared styles
3. Component-specific styles

Example:
```typescript
import '@xyflow/react/dist/base.css';
import '../styles/lod-styles.css';
import '../styles/spike-rate-popup.css';
```
