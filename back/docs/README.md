# SNNverse Backend Documentation

## Quick Links

- **[Architecture](architecture.md)** - System design and component overview
- **[C++ Runner](cpp-runner.md)** - C++ execution engine documentation
- **[Backend Flexibility](backend-flexibility.md)** - CPU/GPU backend switching
- **[GeNN Workflow](genn-workflow.md)** - Model building process
- **[Test Results](test-results.md)** - Testing documentation

## Getting Started

1. **Install dependencies**:
   ```bash
   cd /home/marcos/marcos/snns/SNNverse/back
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Build C++ runner**:
   ```bash
   cd cpp_runner && ./build.sh
   ```

3. **Start backend**:
   ```bash
   python run.py
   ```

## Project Structure

```
back/
├── app/                  # FastAPI backend application
│   ├── main.py          # Main entry point
│   ├── genn_builder.py  # GeNN model compilation
│   └── ...
│
├── cpp_runner/          # C++ execution engine
│   ├── genn_streaming_runner.cpp
│   └── build.sh
│
├── docs/                # Documentation (you are here)
│   ├── README.md        # This file
│   ├── architecture.md  # System architecture
│   └── ...
│
└── run.py               # Server launcher
```

## Key Concepts

### Modular Architecture
The backend uses a **process-based architecture**:
- **Backend API**: Orchestrates everything
- **GeNN Builder**: Compiles neural networks to C++
- **C++ Runner**: Executes models at maximum speed
- **Input Providers**: Inject data from various sources

### Backend Flexibility
The system automatically detects and uses the appropriate backend:
- **GPU (CUDA)**: When available
- **CPU**: Automatic fallback

See [backend-flexibility.md](backend-flexibility.md) for details.

### Performance
The C++ runner provides **100x speedup** over Python:
- Direct execution of compiled GeNN code
- Optimized WebSocket streaming
- Zero-copy memory access

## Development Workflow

1. **Design network** in React frontend
2. **Send to backend** via WebSocket
3. **Backend builds model** using GeNN
4. **C++ runner executes** at full speed
5. **Results stream** to frontend in real-time

## Next Steps

- Read [architecture.md](architecture.md) for system overview
- See [cpp-runner.md](cpp-runner.md) for C++ details
- Check [test-results.md](test-results.md) for test coverage
