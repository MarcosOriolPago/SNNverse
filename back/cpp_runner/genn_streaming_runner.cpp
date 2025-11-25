/**
 * GeNN Streaming Runner - Push-Based Architecture
 * 
 * Continuously streams data to frontend without waiting for responses.
 * Frontend handles backpressure by skipping old frames and keeping fresh data.
 * 
 * Features:
 * - Non-blocking WebSocket sends
 * - Continuous push (no request/response)
 * - Automatic connection management
 * - Optimized message format (spikes: IDs only, voltages: 20ms interval)
 * 
 * Compile:
 *   cd build && cmake .. && make -j$(nproc)
 * 
 * Run:
 *   ./genn_runner <model_code_path> <websocket_port>
 */

#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <set>
#include <queue>
#include <chrono>
#include <thread>
#include <mutex>
#include <atomic>
#include <dlfcn.h>
#include <fstream>

// WebSocket++ (asio-based, non-blocking)
#include <websocketpp/config/asio_no_tls.hpp>
#include <websocketpp/server.hpp>

// JSON
#include <nlohmann/json.hpp>

using json = nlohmann::json;
using websocketpp::connection_hdl;

// WebSocket server type
typedef websocketpp::server<websocketpp::config::asio> WsServer;


/**
 * Message Queue for Non-Blocking Sends
 * Allows simulation to continue even if frontend is slow
 */
class MessageQueue {
private:
    std::queue<std::string> queue;
    std::mutex mutex;
    const size_t max_size = 100;  // Drop old messages if queue grows too large
    
public:
    void push(const std::string& msg) {
        std::lock_guard<std::mutex> lock(mutex);
        
        // Drop oldest messages if queue is full (frontend is lagging)
        while (queue.size() >= max_size) {
            queue.pop();
        }
        
        queue.push(msg);
    }
    
    bool try_pop(std::string& msg) {
        std::lock_guard<std::mutex> lock(mutex);
        if (queue.empty()) return false;
        
        msg = queue.front();
        queue.pop();
        return true;
    }
    
    size_t size() const {
        std::lock_guard<std::mutex> lock(const_cast<std::mutex&>(mutex));
        return queue.size();
    }
};


/**
 * Backend Type Enumeration
 */
enum class BackendType {
    CPU,
    GPU,
    UNKNOWN
};

/**
 * GeNN Streaming Runner
 */
class GeNNStreamingRunner {
private:
    // WebSocket
    WsServer server;
    std::set<connection_hdl, std::owner_less<connection_hdl>> connections;
    std::mutex connections_mutex;
    std::map<connection_hdl, std::shared_ptr<MessageQueue>, std::owner_less<connection_hdl>> message_queues;
    
    // GeNN model
    void* model_lib;
    std::vector<json> neuron_metadata;
    std::map<std::string, float*> voltage_ptrs;
    std::map<std::string, unsigned int*> spike_ptrs;
    std::map<std::string, unsigned int*> spike_cnt_ptrs;
    
    // Backend detection
    BackendType backend_type;
    bool requires_device_sync;
    
    // Simulation state
    std::atomic<bool> running;
    std::atomic<bool> simulation_active;
    unsigned long long timestep;
    float sim_time;
    const float dt = 0.1f;  // ms
    const int voltage_emit_interval = 200;  // Emit every 20ms
    
    // GeNN function pointers
    void (*initialize_fn)();
    void (*step_time_fn)();
    void (*pull_state_fn)();
    
public:
    GeNNStreamingRunner(int port) 
        : model_lib(nullptr), backend_type(BackendType::UNKNOWN),
          requires_device_sync(false), running(true), simulation_active(false),
          timestep(0), sim_time(0.0f) {
        
        // Configure WebSocket server
        server.init_asio();
        server.set_reuse_addr(true);
        
        // Set log levels (reduce noise)
        server.set_access_channels(websocketpp::log::alevel::none);
        server.set_error_channels(websocketpp::log::elevel::warn);
        
        // Register handlers
        server.set_open_handler([this](connection_hdl hdl) {
            this->on_connect(hdl);
        });
        
        server.set_close_handler([this](connection_hdl hdl) {
            this->on_disconnect(hdl);
        });
        
        server.set_message_handler([this](connection_hdl hdl, WsServer::message_ptr msg) {
            this->on_message(hdl, msg);
        });
        
        // Start server
        server.listen(port);
        server.start_accept();
        
        std::cout << "🚀 GeNN Streaming Runner started on port " << port << std::endl;
        std::cout << "   Mode: PUSH (continuous streaming)" << std::endl;
    }
    
    ~GeNNStreamingRunner() {
        if (model_lib) {
            dlclose(model_lib);
        }
    }
    
    bool load_model(const std::string& model_path) {
        std::cout << "📦 Loading model from: " << model_path << std::endl;
        
        // Detect backend type
        detect_backend(model_path);
        
        // Load metadata
        if (!load_metadata(model_path)) {
            return false;
        }
        
        // Load .so library
        std::string lib_path = model_path + "/librunner.so";
        model_lib = dlopen(lib_path.c_str(), RTLD_NOW | RTLD_GLOBAL);
        
        if (!model_lib) {
            std::cerr << "❌ Failed to load library: " << dlerror() << std::endl;
            return false;
        }
        
        // Load function pointers
        initialize_fn = (void(*)())dlsym(model_lib, "initialize");
        step_time_fn = (void(*)())dlsym(model_lib, "stepTime");
        pull_state_fn = (void(*)())dlsym(model_lib, "pullStateFromDevice");
        
        if (!initialize_fn || !step_time_fn) {
            std::cerr << "❌ Failed to load GeNN functions" << std::endl;
            return false;
        }
        
        // Check for device sync function (GPU only)
        if (!pull_state_fn) {
            if (backend_type == BackendType::GPU) {
                std::cout << "⚠️  pullStateFromDevice not found but GPU backend detected" << std::endl;
            } else {
                std::cout << "✓ CPU backend detected, device synchronization not required" << std::endl;
            }
            requires_device_sync = false;
        } else {
            std::cout << "✓ GPU backend detected, device synchronization available" << std::endl;
            requires_device_sync = true;
        }
        
        // Initialize model
        std::cout << "Initializing GeNN model..." << std::endl;
        try {
            initialize_fn();
            std::cout << "✓ GeNN model initialized" << std::endl;
        }
        catch (std::exception& e) {
            std::cerr << "❌ Failed to initialize: " << e.what() << std::endl;
            return false;
        }
        
        // Get pointers to neuron arrays
        std::cout << "Loading neuron array pointers..." << std::endl;
        for (const auto& neuron : neuron_metadata) {
            std::string name = neuron["name"];
            std::string id = neuron["id"];
            
            // Voltage: <name>V
            std::string v_sym = name + "V";
            float* v_ptr = (float*)dlsym(model_lib, v_sym.c_str());
            if (v_ptr) {
                voltage_ptrs[id] = v_ptr;
            }
            
            // Spikes: glbSpk<name> and glbSpkCnt<name>
            std::string spk_sym = "glbSpk" + name;
            std::string cnt_sym = "glbSpkCnt" + name;
            
            unsigned int* spk_ptr = (unsigned int*)dlsym(model_lib, spk_sym.c_str());
            unsigned int* cnt_ptr = (unsigned int*)dlsym(model_lib, cnt_sym.c_str());
            
            if (spk_ptr && cnt_ptr) {
                spike_ptrs[id] = spk_ptr;
                spike_cnt_ptrs[id] = cnt_ptr;
            }
            
            std::cout << "  ✓ " << id << " (V=" << (v_ptr ? "OK" : "FAIL") 
                      << ", Spikes=" << (spk_ptr ? "OK" : "FAIL") << ")" << std::endl;
        }
        
        std::cout << "✓ Model loaded successfully" << std::endl;
        return true;
    }
    
    void run() {
        // Start WebSocket server in background
        std::thread ws_thread([this]() {
            server.run();
        });
        
        // Start message sender thread
        std::thread sender_thread([this]() {
            this->message_sender_loop();
        });
        
        std::cout << "✓ Server ready. Waiting for connections..." << std::endl;
        std::cout << "  Send 'start' message to begin simulation" << std::endl;
        
        // Main simulation loop
        while (running) {
            if (simulation_active) {
                run_simulation_step();
            } else {
                std::this_thread::sleep_for(std::chrono::milliseconds(10));
            }
        }
        
        ws_thread.join();
        sender_thread.join();
    }
    
    void stop() {
        running = false;
        simulation_active = false;
        server.stop();
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
    
    bool load_metadata(const std::string& model_path) {
        std::string metadata_path = model_path + "/neuron_metadata.json";
        std::ifstream file(metadata_path);
        
        if (!file.is_open()) {
            std::cerr << "⚠️  Metadata file not found: " << metadata_path << std::endl;
            std::cerr << "   Using default metadata" << std::endl;
            
            // Use default (parse from directory structure)
            // For now, return success - will discover neurons dynamically
            return true;
        }
        
        try {
            json metadata = json::parse(file);
            neuron_metadata = metadata["neurons"];
            
            std::cout << "✓ Loaded metadata: " << neuron_metadata.size() << " neurons" << std::endl;
            return true;
        }
        catch (std::exception& e) {
            std::cerr << "❌ Failed to parse metadata: " << e.what() << std::endl;
            return false;
        }
    }
    
    void on_connect(connection_hdl hdl) {
        std::lock_guard<std::mutex> lock(connections_mutex);
        connections.insert(hdl);
        message_queues[hdl] = std::make_shared<MessageQueue>();
        
        std::cout << "🔌 Client connected (total: " << connections.size() << ")" << std::endl;
        
        // Send metadata immediately
        send_metadata(hdl);
    }
    
    void on_disconnect(connection_hdl hdl) {
        std::lock_guard<std::mutex> lock(connections_mutex);
        connections.erase(hdl);
        message_queues.erase(hdl);
        
        std::cout << "🔌 Client disconnected (total: " << connections.size() << ")" << std::endl;
    }
    
    void on_message(connection_hdl hdl, WsServer::message_ptr msg) {
        std::string payload = msg->get_payload();
        
        try {
            json cmd = json::parse(payload);
            std::string action = cmd.value("action", "");
            
            if (action == "start") {
                std::cout << "▶️  Starting simulation..." << std::endl;
                simulation_active = true;
                timestep = 0;
                sim_time = 0.0f;
            }
            else if (action == "stop") {
                std::cout << "⏸️  Stopping simulation..." << std::endl;
                simulation_active = false;
            }
            else if (action == "ping") {
                // Respond to ping for connection testing
                queue_message(hdl, json{{"type", "pong"}}.dump());
            }
        }
        catch (json::parse_error& e) {
            std::cerr << "❌ Parse error: " << e.what() << std::endl;
        }
    }
    
    void run_simulation_step() {
        // Step simulation
        step_time_fn();
        timestep++;
        sim_time = timestep * dt;
        
        // Pull state from GPU (only when needed and if GPU backend)
        bool need_pull = (timestep % voltage_emit_interval == 0);
        if (need_pull && requires_device_sync && pull_state_fn) {
            pull_state_fn();
        }
        
        // Check for spikes (every step)
        emit_spikes();
        
        // Emit voltages (every 20ms)
        if (timestep % voltage_emit_interval == 0) {
            emit_voltages();
        }
        
        // Tiny sleep to prevent CPU saturation (optional)
        // Comment out for maximum speed
        // std::this_thread::sleep_for(std::chrono::microseconds(10));
    }
    
    void emit_spikes() {
        std::vector<std::string> spiked_ids;
        
        for (const auto& [id, cnt_ptr] : spike_cnt_ptrs) {
            if (cnt_ptr[0] > 0) {
                spiked_ids.push_back(id);
            }
        }
        
        if (!spiked_ids.empty()) {
            json msg = {
                {"type", "spike"},
                {"t", sim_time},
                {"ids", spiked_ids}
            };
            
            broadcast(msg.dump());
        }
    }
    
    void emit_voltages() {
        json neurons = json::array();
        
        for (const auto& [id, v_ptr] : voltage_ptrs) {
            neurons.push_back({
                {"id", id},
                {"v", v_ptr[0]}
            });
        }
        
        json msg = {
            {"type", "voltage"},
            {"t", sim_time},
            {"step", timestep},
            {"neurons", neurons}
        };
        
        broadcast(msg.dump());
    }
    
    void send_metadata(connection_hdl hdl) {
        json msg = {
            {"type", "metadata"},
            {"dt", dt},
            {"voltage_interval_ms", voltage_emit_interval * dt},
            {"neurons", neuron_metadata}
        };
        
        queue_message(hdl, msg.dump());
    }
    
    void queue_message(connection_hdl hdl, const std::string& msg) {
        std::lock_guard<std::mutex> lock(connections_mutex);
        if (message_queues.count(hdl) > 0) {
            message_queues[hdl]->push(msg);
        }
    }
    
    void broadcast(const std::string& msg) {
        std::lock_guard<std::mutex> lock(connections_mutex);
        for (auto& [hdl, queue] : message_queues) {
            queue->push(msg);
        }
    }
    
    void message_sender_loop() {
        // Background thread that sends queued messages
        while (running) {
            std::lock_guard<std::mutex> lock(connections_mutex);
            
            for (auto it = message_queues.begin(); it != message_queues.end(); ) {
                auto hdl = it->first;
                auto& queue = it->second;
                
                std::string msg;
                while (queue->try_pop(msg)) {
                    try {
                        server.send(hdl, msg, websocketpp::frame::opcode::text);
                    }
                    catch (std::exception& e) {
                        // Connection dead, will be removed by close handler
                        break;
                    }
                }
                
                ++it;
            }
            
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
    }
};


int main(int argc, char* argv[]) {
    if (argc < 3) {
        std::cerr << "Usage: " << argv[0] << " <model_path> <port>" << std::endl;
        std::cerr << "Example: " << argv[0] << " /tmp/genn_models_xyz/user_network_CODE 9002" << std::endl;
        return 1;
    }
    
    std::string model_path = argv[1];
    int port = std::stoi(argv[2]);
    
    std::cout << "═══════════════════════════════════════════════════════" << std::endl;
    std::cout << "  GeNN Streaming Runner (PUSH Mode)" << std::endl;
    std::cout << "═══════════════════════════════════════════════════════" << std::endl;
    
    try {
        GeNNStreamingRunner runner(port);
        
        if (!runner.load_model(model_path)) {
            std::cerr << "❌ Failed to load model" << std::endl;
            return 1;
        }
        
        // Run (blocks until stopped)
        runner.run();
    }
    catch (std::exception& e) {
        std::cerr << "❌ Fatal error: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}
