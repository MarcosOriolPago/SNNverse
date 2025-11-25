cmake_minimum_required(VERSION 3.10)
project(GeNNWebSocketRunner CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Optimization flags
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -march=native")

# Find required packages
find_package(Threads REQUIRED)
find_package(Boost COMPONENTS system REQUIRED)

# WebSocket++ is header-only, just need to add include path
# Install with: sudo apt-get install libwebsocketpp-dev
include_directories(/usr/include)

# nlohmann/json is header-only
# Install with: sudo apt-get install nlohmann-json3-dev
find_package(nlohmann_json 3.2.0 REQUIRED)

# Add executable (use streaming runner)
add_executable(genn_runner
    genn_streaming_runner.cpp
)

# Link libraries
target_link_libraries(genn_runner
    ${CMAKE_THREAD_LIBS_INIT}
    ${Boost_LIBRARIES}
    ${CMAKE_DL_LIBS}  # For dlopen/dlsym
    nlohmann_json::nlohmann_json
)

# Installation
install(TARGETS genn_runner DESTINATION bin)