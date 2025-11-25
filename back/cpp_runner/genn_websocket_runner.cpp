/**
 * GeNN WebSocket Runner
 * 
 * Standalone C++ application that:
 * 1. Loads compiled GeNN model (.so library)
 * 2. Runs simulation loop
 * 3. Streams data via WebSocket (optimized):
 *    - Voltage (V_m): Every 20ms (200 timesteps at dt=0.1ms)
 *    - Spikes: Immediately, neuron ID only
 * 
 * Compile:
 *   g++ -std=c++17 -O3 -o genn_runner genn_websocket_runner.cpp \
 *       -I/path/to/genn/include \
 *       -L/path/to/generated/CODE \
 *       -lrunner -lpthread -lwebsocketpp -lboost_system
 * 
 * Run:
 *   ./genn_runner <path_to_user_network_CODE> <websocket_port>
 */

#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <chrono>
#include <thread>
#include <dlfcn.h>
#include <cstring>
#include <sstream>
#include <iomanip>

// WebSocket++ headers (lightweight C++ WebSocket library)
#include <websocketpp/config/asgi.hpp>
#include <websocketpp/server.hpp>

// JSON library for message formatting (use nlohmann/json or similar)
#include <nlohmann/json.hpp>

using json = nlohmann::json;

// WebSocket server type
typedef websocketpp::server<websocketpp::config::asgi> server;
typedef server::message_ptr message_ptr;

using websocketpp::connection_hdl;


/**
 * Backend Type Enumeration
 */
enum class BackendType {
    CPU,
    GPU,
    UNKNOWN
};

/**
 * GeNN Model Interface
 * These function pointers will be loaded from the compiled GeNN library
 */
struct GeNNModelInterface {
    void (*initialize)();
    void (*stepTime)();
    void (*pullStateFromDevice)();
    
    // Access to neuron populations
    float* (*getNeuronV)(const char* pop_name);
    unsigned int* (*getCurrentSpikes)(const char* pop_name, unsigned int* count);
    
    // Simulation state
    float (*getTime)();
    unsigned long long (*getTimestep)();
};


/**
 * Neuron Population Metadata
 */
struct NeuronPopulation {
    std::string id;
    std::string name;
    int size;
};


/**
 * GeNN WebSocket Runner
 */
class GeNNWebSocketRunner {
private:
    server ws_server;
    std::set<connection_hdl, std::owner_less<connection_hdl>> connections;
    
    void* model_lib;
    GeNNModelInterface model;
    
    std::vector<NeuronPopulation> populations;
    std::map<std::string, float*> voltage_ptrs;
    
    // Backend detection
    BackendType backend_type;
    bool requires_device_sync;
    
    // Simulation parameters
    const float dt = 0.1f;  // ms per timestep
    const int voltage_emit_interval = 200;  // emit every 200 steps (20ms)
    
    unsigned long long timestep;
    float sim_time;
    bool running;
    
public:
    GeNNWebSocketRunner(const std::string& model_path, int port) 
        : model_lib(nullptr), backend_type(BackendType::UNKNOWN),
          requires_device_sync(false), timestep(0), sim_time(0.0f), running(false) {
        
        // Load GeNN model library
        load_model(model_path);
        
        // Initialize WebSocket server
        ws_server.init_asio();
        ws_server.set_reuse_addr(true);
        
        // Register handlers
        ws_server.set_open_handler([this](connection_hdl hdl) {
            this->on_open(hdl);
        });
        
        ws_server.set_close_handler([this](connection_hdl hdl) {
            this->on_close(hdl);
        });
        
        ws_server.set_message_handler([this](connection_hdl hdl, message_ptr msg) {
            this->on_message(hdl, msg);
        });
        
        // Listen on port
        ws_server.listen(port);
        ws_server.start_accept();
        
        std::cout << "🚀 GeNN WebSocket Runner started on port " << port << std::endl;
    }
    
    ~GeNNWebSocketRunner() {
        if (model_lib) {
            dlclose(model_lib);
        }
    }
    
    void load_model(const std::string& model_path) {
        std::cout << "📦 Loading GeNN model from: " << model_path << std::endl;
        
        // Detect backend type
        detect_backend(model_path);
        
        // Load shared library
        std::string lib_path = model_path + "/librunner.so";
        model_lib = dlopen(lib_path.c_str(), RTLD_NOW);
        
        if (!model_lib) {
            std::cerr << "❌ Failed to load model: " << dlerror() << std::endl;
            exit(1);
        }
        
        // Load function pointers
        model.initialize = (void(*)())dlsym(model_lib, "initialize");
        model.stepTime = (void(*)())dlsym(model_lib, "stepTime");
        model.pullStateFromDevice = (void(*)())dlsym(model_lib, "pullStateFromDevice");
        
        // Check if device sync is available
        if (!model.pullStateFromDevice) {
            if (backend_type == BackendType::GPU) {
                std::cout << "⚠️  pullStateFromDevice not found but GPU backend detected" << std::endl;
            } else {
                std::cout << "✓ CPU backend detected, device synchronization not required" << std::endl;
            }
            requires_device_sync = false;
        } else {
            std::cout << "✓ Device synchronization available" << std::endl;
            requires_device_sync = true;
        }
        
        // GeNN generates specific symbols for each population
        // For now, we'll use a simplified interface
        // In production, you'd parse definitions.h or use a manifest
        
        std::cout << "✓ Model loaded successfully" << std::endl;
        
        // Initialize GeNN model
        model.initialize();
        std::cout << "✓ Model initialized" << std::endl;
    }
    
    void register_population(const std::string& id, const std::string& name, int size) {
        NeuronPopulation pop{id, name, size};
        populations.push_back(pop);
        
        // Get pointer to voltage array
        // GeNN generates: float* <popName>V
        std::string v_symbol = name + "V";
        float* v_ptr = (float*)dlsym(model_lib, v_symbol.c_str());
        if (v_ptr) {
            voltage_ptrs[id] = v_ptr;
            std::cout << "  Registered population: " << id << " (" << size << " neurons)" << std::endl;
        }
    }
    
    void run_server() {
        // Run WebSocket server in separate thread
        std::thread server_thread([this]() {
            ws_server.run();
        });
        
        std::cout << "🎯 Ready for connections. Waiting for START command..." << std::endl;
        
        // Wait for server
        server_thread.join();
    }
    
    void start_simulation() {
        running = true;
        timestep = 0;
        sim_time = 0.0f;
        
        std::cout << "▶️  Starting simulation..." << std::endl;
        
        // Send initial metadata to clients
        send_metadata();
        
        // Main simulation loop
        while (running) {
            // Step 1: Advance simulation by one timestep
            model.stepTime();
            timestep++;
            sim_time = timestep * dt;
            
            // Step 2: Pull state from device (GPU -> CPU) - only if needed
            if ((timestep % voltage_emit_interval == 0 || check_for_spikes()) 
                && requires_device_sync && model.pullStateFromDevice) {
                model.pullStateFromDevice();
            }
            
            // Step 3: Check for spikes and emit immediately
            emit_spikes();
            
            // Step 4: Emit voltage every 20ms (200 steps)
            if (timestep % voltage_emit_interval == 0) {
                emit_voltages();
            }
            
            // Step 5: Small sleep to control speed (optional)
            // std::this_thread::sleep_for(std::chrono::microseconds(100));
        }
        
        std::cout << "⏸️  Simulation stopped at t=" << sim_time << "ms" << std::endl;
    }
    
    void stop_simulation() {
        running = false;
    }
    
private:
    void detect_backend(const std::string& model_path) {
        std::string backend_info_path = model_path + "/backend_info.json";
        std::ifstream file(backend_info_path);
        
        if (!file.is_open()) {
            std::cout << "⚠️  Backend info not found, attempting auto-detection..." << std::endl;
            backend_type = BackendType::UNKNOWN;
            return;
        }
        
        try {
            json backend_info = json::parse(file);
            std::string backend_type_str = backend_info.value("backend_type", "unknown");
            requires_device_sync = backend_info.value("requires_device_sync", false);
            
            if (backend_type_str == "cpu") {
                backend_type = BackendType::CPU;
                std::cout << "✓ Backend: CPU (single_threaded_cpu)" << std::endl;
            } else if (backend_type_str == "gpu") {
                backend_type = BackendType::GPU;
                std::cout << "✓ Backend: GPU (" << backend_info.value("backend", "cuda") << ")" << std::endl;
            } else {
                backend_type = BackendType::UNKNOWN;
                std::cout << "⚠️  Unknown backend type: " << backend_type_str << std::endl;
            }
        }
        catch (std::exception& e) {
            std::cerr << "⚠️  Failed to parse backend info: " << e.what() << std::endl;
            backend_type = BackendType::UNKNOWN;
        }
    }
    
    void on_open(connection_hdl hdl) {
        connections.insert(hdl);
        std::cout << "🔌 Client connected (total: " << connections.size() << ")" << std::endl;
    }
    
    void on_close(connection_hdl hdl) {
        connections.erase(hdl);
        std::cout << "🔌 Client disconnected (total: " << connections.size() << ")" << std::endl;
    }
    
    void on_message(connection_hdl hdl, message_ptr msg) {
        std::string payload = msg->get_payload();
        std::cout << "📨 Received: " << payload << std::endl;
        
        try {
            json cmd = json::parse(payload);
            std::string action = cmd["action"];
            
            if (action == "start") {
                std::thread sim_thread([this]() {
                    this->start_simulation();
                });
                sim_thread.detach();
            }
            else if (action == "stop") {
                stop_simulation();
            }
            else if (action == "get_state") {
                send_state_snapshot(hdl);
            }
        }
        catch (json::parse_error& e) {
            std::cerr << "❌ JSON parse error: " << e.what() << std::endl;
        }
    }
    
    void broadcast(const std::string& message) {
        for (auto it : connections) {
            try {
                ws_server.send(it, message, websocketpp::frame::opcode::text);
            }
            catch (websocketpp::exception const & e) {
                std::cerr << "❌ Send failed: " << e.what() << std::endl;
            }
        }
    }
    
    void send_metadata() {
        json meta = {
            {"type", "metadata"},
            {"dt", dt},
            {"voltage_emit_interval_ms", voltage_emit_interval * dt},
            {"populations", json::array()}
        };
        
        for (const auto& pop : populations) {
            meta["populations"].push_back({
                {"id", pop.id},
                {"name", pop.name},
                {"size", pop.size}
            });
        }
        
        broadcast(meta.dump());
        std::cout << "📋 Sent metadata to clients" << std::endl;
    }
    
    bool check_for_spikes() {
        // Quick check if any spikes occurred
        // GeNN stores current spikes in glbSpk arrays
        // This is a simplified check - in production, check actual spike buffers
        return (timestep % 10) == 0;  // Placeholder
    }
    
    void emit_spikes() {
        // Optimized: Only send neuron IDs that spiked
        json spike_msg = {
            {"type", "spikes"},
            {"t", sim_time},
            {"ids", json::array()}
        };
        
        // For each population, check for spikes
        for (const auto& pop : populations) {
            // GeNN generates: unsigned int* glbSpk<PopName>
            // and: unsigned int glbSpkCnt<PopName>[1]
            std::string spk_symbol = "glbSpk" + pop.name;
            std::string cnt_symbol = "glbSpkCnt" + pop.name;
            
            unsigned int* spike_ids = (unsigned int*)dlsym(model_lib, spk_symbol.c_str());
            unsigned int* spike_cnt = (unsigned int*)dlsym(model_lib, cnt_symbol.c_str());
            
            if (spike_ids && spike_cnt && spike_cnt[0] > 0) {
                // Add spiked neuron IDs to message
                for (unsigned int i = 0; i < spike_cnt[0]; i++) {
                    spike_msg["ids"].push_back(pop.id);  // Use node ID from frontend
                }
            }
        }
        
        // Only send if there are spikes
        if (!spike_msg["ids"].empty()) {
            broadcast(spike_msg.dump());
            std::cout << "⚡ Emitted " << spike_msg["ids"].size() << " spikes at t=" 
                      << sim_time << "ms" << std::endl;
        }
    }
    
    void emit_voltages() {
        // Optimized: Send voltage values every 20ms
        json voltage_msg = {
            {"type", "voltages"},
            {"t", sim_time},
            {"step", timestep},
            {"neurons", json::array()}
        };
        
        // Collect voltage for all neurons
        for (const auto& pop : populations) {
            if (voltage_ptrs.count(pop.id) > 0) {
                float* v_array = voltage_ptrs[pop.id];
                
                // For single-neuron populations, send the voltage directly
                // For multi-neuron populations, you might average or send first neuron
                voltage_msg["neurons"].push_back({
                    {"id", pop.id},
                    {"v", v_array[0]}  // First neuron's voltage
                });
            }
        }
        
        broadcast(voltage_msg.dump());
        std::cout << "📊 Emitted voltages at t=" << sim_time << "ms" << std::endl;
    }
    
    void send_state_snapshot(connection_hdl hdl) {
        json state = {
            {"type", "state"},
            {"t", sim_time},
            {"step", timestep},
            {"running", running},
            {"neurons", json::array()}
        };
        
        // Pull latest state (only if GPU backend)
        if (requires_device_sync && model.pullStateFromDevice) {
            model.pullStateFromDevice();
        }
        
        for (const auto& pop : populations) {
            if (voltage_ptrs.count(pop.id) > 0) {
                state["neurons"].push_back({
                    {"id", pop.id},
                    {"v", voltage_ptrs[pop.id][0]}
                });
            }
        }
        
        try {
            ws_server.send(hdl, state.dump(), websocketpp::frame::opcode::text);
        }
        catch (websocketpp::exception const & e) {
            std::cerr << "❌ Send failed: " << e.what() << std::endl;
        }
    }
};


/**
 * Main Entry Point
 */
int main(int argc, char* argv[]) {
    if (argc < 3) {
        std::cerr << "Usage: " << argv[0] << " <model_code_path> <websocket_port>" << std::endl;
        std::cerr << "Example: " << argv[0] << " /tmp/genn_models_xyz/user_network_CODE 9002" << std::endl;
        return 1;
    }
    
    std::string model_path = argv[1];
    int port = std::stoi(argv[2]);
    
    std::cout << "═════════════════════════════════════════════════════════" << std::endl;
    std::cout << "  GeNN WebSocket Runner" << std::endl;
    std::cout << "═════════════════════════════════════════════════════════" << std::endl;
    std::cout << "Model: " << model_path << std::endl;
    std::cout << "Port:  " << port << std::endl;
    std::cout << "═════════════════════════════════════════════════════════" << std::endl;
    
    try {
        GeNNWebSocketRunner runner(model_path, port);
        
        // Register populations (in production, parse from metadata file)
        // For now, hardcode example populations
        runner.register_population("neuron1", "neuron1", 1);
        runner.register_population("neuron2", "neuron2", 1);
        
        // Run server
        runner.run_server();
    }
    catch (std::exception& e) {
        std::cerr << "❌ Fatal error: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}
