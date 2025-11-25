#!/bin/bash
#
# Build script for GeNN WebSocket Runner
#
# Usage: ./build.sh
#

set -e

echo "═══════════════════════════════════════════════════════"
echo "  Building GeNN WebSocket Runner"
echo "═══════════════════════════════════════════════════════"

# Check dependencies
echo "Checking dependencies..."

# Check for required packages
DEPS_MISSING=0

if ! dpkg -s libwebsocketpp-dev &> /dev/null; then
    echo "❌ libwebsocketpp-dev not found"
    echo "   Install with: sudo apt-get install libwebsocketpp-dev"
    DEPS_MISSING=1
fi

if ! dpkg -s nlohmann-json3-dev &> /dev/null; then
    echo "❌ nlohmann-json3-dev not found"
    echo "   Install with: sudo apt-get install nlohmann-json3-dev"
    DEPS_MISSING=1
fi

if ! dpkg -s libboost-system-dev &> /dev/null; then
    echo "❌ libboost-system-dev not found"
    echo "   Install with: sudo apt-get install libboost-system-dev"
    DEPS_MISSING=1
fi

if [ $DEPS_MISSING -eq 1 ]; then
    echo ""
    echo "Please install missing dependencies and try again."
    echo "Quick install: sudo apt-get install libwebsocketpp-dev nlohmann-json3-dev libboost-system-dev"
    exit 1
fi

echo "✓ All dependencies found"

# Create build directory
mkdir -p build
cd build

# Configure with CMake
echo ""
echo "Configuring with CMake..."
cmake ..

# Build
echo ""
echo "Building..."
make -j$(nproc)

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Build successful!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Executable: $(pwd)/genn_runner"
echo ""
echo "Usage: ./genn_runner <model_code_path> <websocket_port>"
echo "Example: ./genn_runner /tmp/genn_models_xyz/user_network_CODE 9002"
echo ""
echo "═══════════════════════════════════════════════════════"
