# SNNverse Documentation

Welcome to the SNNverse documentation! This directory contains comprehensive guides for understanding and using the visualization features of SNNverse.

## 📚 Documentation Index

### Core Features

#### [SPIKE_RATE_POPUP.md](./SPIKE_RATE_POPUP.md)
**Real-time spike rate monitoring popup**

Click any neuron during simulation to see:
- Current spike rate (Hz)
- Average spike rate since popup opened
- Peak spike rate observed
- Visual sparkline chart showing activity history

Perfect for debugging and analyzing individual neuron behavior.

---

#### [CUSTOM_FUNCTIONS.md](./CUSTOM_FUNCTIONS.md)
**Python-based spike generation for input nodes**

Learn how to write custom Python functions that control when input nodes generate spikes:
- Function signature and parameters
- Security sandbox features
- Available modules (math, random, time)
- Example patterns (periodic, random, bursts, etc.)
- Testing and troubleshooting

Essential for creating realistic input patterns for your SNN simulations.

---

### Architecture & Optimization

#### [VISUALIZATION_OPTIMIZATION.md](./VISUALIZATION_OPTIMIZATION.md)
**Technical deep-dive into the visualization system**

Understand how SNNverse achieves high performance:
- Aggregate status-based visualization (replacing individual spike animations)
- Event bus architecture
- Data aggregation strategies
- Socket.io vs polling modes
- Performance benchmarks (scales to 1000+ neurons)

Read this to understand the core design decisions behind the visualization system.

---

#### [FLUID_VISUALIZATION.md](./FLUID_VISUALIZATION.md)
**Smooth gradient colors and interaction locks**

Details on the visual feedback system:
- **Gradient color interpolation**: Gray → Yellow → Green based on spike rate
- **Smooth transitions**: CSS-based animations for fluid updates
- **Fast updates**: 100ms aggregation windows (10 Hz)
- **Interaction locks**: Prevents layout changes during simulation
- Customization options for colors and update speed

Essential for understanding what the colors mean and how to tune visual responsiveness.

---

### Configuration & Performance

#### [PERFORMANCE_TUNING.md](./PERFORMANCE_TUNING.md)
**Quick reference guide for optimizing based on network size**

Recommended settings for different scenarios:
- **Small networks** (<100 neurons): Default settings
- **Medium networks** (100-500 neurons): Socket.io with throttling
- **Large networks** (500-1000 neurons): Polling mode
- **Very large networks** (>1000 neurons): Aggressive optimization

Includes troubleshooting tips for common performance issues.

---

#### [CSS_ORGANIZATION.md](./CSS_ORGANIZATION.md)
**Code organization documentation**

Documents the refactoring of inline styles to external CSS:
- File structure and naming conventions
- Style guidelines
- Benefits of external CSS (maintainability, performance)
- Build impact analysis

Useful for developers working on the frontend styling.

---

## 🚀 Quick Start

### For Users
1. Start with **SPIKE_RATE_POPUP.md** to understand the monitoring tools
2. Read **CUSTOM_FUNCTIONS.md** to create custom input patterns
3. Check **PERFORMANCE_TUNING.md** if you experience lag

### For Developers
1. Read **VISUALIZATION_OPTIMIZATION.md** for architecture overview
2. Review **FLUID_VISUALIZATION.md** for visual system details
3. Consult **CSS_ORGANIZATION.md** for frontend styling conventions

### For Performance Issues
1. Go directly to **PERFORMANCE_TUNING.md**
2. Adjust settings based on your network size
3. Monitor browser DevTools Performance tab

---

## 🎨 Visual Guide

### Axon Colors (Connection Activity)
| Color | Spike Rate | Meaning |
|-------|-----------|---------|
| Gray (dashed) | 0 Hz | No activity |
| Gray→Yellow | 1-50 Hz | Low activity |
| Yellow→Green | 50-100 Hz | Moderate activity |
| Green (solid) | 100+ Hz | High activity |

### Neuron Colors (Membrane Voltage)
| Color | Voltage | Meaning |
|-------|---------|---------|
| Gray | ~-70mV | Resting potential |
| Yellow | ~-55mV | Near threshold |

---

## 📂 File Organization

```
docs/
├── README.md                          (this file)
├── SPIKE_RATE_POPUP.md               (feature guide)
├── CUSTOM_FUNCTIONS.md               (input programming)
├── VISUALIZATION_OPTIMIZATION.md     (architecture)
├── FLUID_VISUALIZATION.md            (visual system)
├── PERFORMANCE_TUNING.md             (configuration)
└── CSS_ORGANIZATION.md               (code organization)
```

---

## 🔧 Configuration Files

The documentation references these configuration files:

### Frontend
- `front/src/config/visualization.ts` - Visualization behavior settings
- `front/src/styles/spike-rate-popup.css` - Popup styling
- `front/src/components/NodeLayout.tsx` - Main visualization logic
- `front/src/components/Axon.tsx` - Axon rendering and colors

### Backend
- `back/app/main.py` - Simulation engine and emission throttling
- `back/app/sandbox.py` - Custom function execution sandbox
- `back/app/schemas.py` - Data models for custom functions

---

## 🐛 Troubleshooting

### Visualization Issues
- **Axons stay gray**: Check console for spike rate updates, verify edges have unique IDs
- **Browser freezing**: Enable polling mode, increase aggregation window
- **Popup doesn't appear**: Ensure simulation is running, check browser console

### Performance Issues
- **Lag with many neurons**: See PERFORMANCE_TUNING.md for optimization settings
- **Memory increasing**: Check for event listener leaks in DevTools
- **Delayed updates**: Reduce polling interval or emission throttling

### Custom Functions
- **Function not executing**: Check syntax, verify return type is boolean
- **Import errors**: Only math, random, and time modules are allowed
- **Timeout errors**: Simplify function logic, reduce computation

---

## 📝 Contributing

When adding new features:
1. Document user-facing features in dedicated .md files
2. Update this README.md index
3. Add troubleshooting sections
4. Include configuration examples
5. Provide visual examples where applicable

---

## 📊 Version History

- **v2.0** (Current): Aggregate spike rate visualization with gradient colors
- **v1.0**: Individual spike animations (deprecated)

---

## 🔗 Related Documentation

- See `front/src/styles/README.md` for CSS style guidelines
- See `back/test_workflow.py` for custom function test examples
- Check root-level docs for general project setup

---

**Last Updated**: November 2024  
**Maintained By**: SNNverse Development Team
