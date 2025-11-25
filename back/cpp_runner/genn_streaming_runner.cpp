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
#include <sstream>

// Network includes
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <fcntl.h>

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
    
    // TCP Input Server
    int tcp_socket;
    int tcp_port;
    std::atomic<bool> tcp_listening;
    std::mutex input_queue_mutex;
    std::queue<json> input_queue;  // Thread-safe input command queue
    
    // Simulation state
    std::atomic<bool> running;
    std::atomic<bool> simulation_active;
    unsigned long long timestep;
    float sim_time;
    const float dt = 0.1f;  // ms
    const int voltage_emit_interval = 200;  // Emit every 20ms
    
    // GeNN function pointers
    void (*allocate_mem_fn)();
    void (*initialize_fn)();
    void (*step_time_fn)(unsigned long long, unsigned long long);
    void (*pull_state_fn)();
    
public:
    GeNNStreamingRunner(int ws_port, int input_port = 9001) 
        : model_lib(nullptr), backend_type(BackendType::UNKNOWN),
          requires_device_sync(false), tcp_socket(-1), tcp_port(input_port),
          tcp_listening(false), running(true), simulation_active(false),
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
        server.listen(ws_port);
        server.start_accept();
        
        std::cout << "🚀 GeNN Streaming Runner started" << std::endl;
        std::cout << "   WebSocket: port " << ws_port << std::endl;
        std::cout << "   TCP Input: port " << tcp_port << std::endl;
        std::cout << "   Mode: PUSH (continuous streaming)" << std::endl;
    }
    
    ~GeNNStreamingRunner() {
        // Close TCP socket
        if (tcp_socket >= 0) {
            close(tcp_socket);
        }
        
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
        allocate_mem_fn = (void(*)())dlsym(model_lib, "allocateMem");
        initialize_fn = (void(*)())dlsym(model_lib, "initialize");
        step_time_fn = (void(*)(unsigned long long, unsigned long long))dlsym(model_lib, "stepTime");
        pull_state_fn = (void(*)())dlsym(model_lib, "pullStateFromDevice");
        
        if (!allocate_mem_fn || !initialize_fn || !step_time_fn) {
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
        
        // Allocate memory
        std::cout << "Allocating GeNN model memory..." << std::endl;
        try {
            allocate_mem_fn();
            std::cout << "✓ Memory allocated" << std::endl;
        }
        catch (std::exception& e) {
            std::cerr << "❌ Failed to allocate memory: " << e.what() << std::endl;
            return false;
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
    
    bool start_tcp_server() {
        // Create TCP socket
        tcp_socket = socket(AF_INET, SOCK_STREAM, 0);
        if (tcp_socket < 0) {
            std::cerr << "❌ Failed to create TCP socket" << std::endl;
            return false;
        }
        
        // Set socket options
        int opt = 1;
        if (setsockopt(tcp_socket, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt)) < 0) {
            std::cerr << "⚠️  Failed to set SO_REUSEADDR" << std::endl;
        }
        
        // Bind to port
        struct sockaddr_in addr;
        addr.sin_family = AF_INET;
        addr.sin_addr.s_addr = INADDR_ANY;
        addr.sin_port = htons(tcp_port);
        
        if (bind(tcp_socket, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
            std::cerr << "❌ Failed to bind TCP socket to port " << tcp_port << std::endl;
            close(tcp_socket);
            tcp_socket = -1;
            return false;
        }
        
        // Listen
        if (listen(tcp_socket, 5) < 0) {
            std::cerr << "❌ Failed to listen on TCP socket" << std::endl;
            close(tcp_socket);
            tcp_socket = -1;
            return false;
        }
        
        std::cout << "✓ TCP input server listening on port " << tcp_port << std::endl;
        tcp_listening = true;
        return true;
    }
    
    void tcp_server_loop() {
        while (running && tcp_listening) {
            // Accept connections (non-blocking with timeout)
            fd_set read_fds;
            struct timeval tv;
            FD_ZERO(&read_fds);
            FD_SET(tcp_socket, &read_fds);
            tv.tv_sec = 0;
            tv.tv_usec = 100000;  // 100ms timeout
            
            int activity = select(tcp_socket + 1, &read_fds, NULL, NULL, &tv);
            
            if (activity < 0) continue;
            if (activity == 0) continue;  // Timeout
            
            // Accept connection
            struct sockaddr_in client_addr;
            socklen_t client_len = sizeof(client_addr);
            int client_socket = accept(tcp_socket, (struct sockaddr*)&client_addr, &client_len);
            
            if (client_socket < 0) continue;
            
            std::cout << "🔌 Input provider connected" << std::endl;
            
            // Handle client in this thread (one connection at a time)
            handle_tcp_client(client_socket);
            
            close(client_socket);
            std::cout << "🔌 Input provider disconnected" << std::endl;
        }
    }
    
    void handle_tcp_client(int client_socket) {
        char buffer[4096];
        std::string accumulated;
        
        while (running) {
            // Read data with timeout
            fd_set read_fds;
            struct timeval tv;
            FD_ZERO(&read_fds);
            FD_SET(client_socket, &read_fds);
            tv.tv_sec = 0;
            tv.tv_usec = 100000;  // 100ms timeout
            
            int activity = select(client_socket + 1, &read_fds, NULL, NULL, &tv);
            
            if (activity < 0) break;  // Error
            if (activity == 0) continue;  // Timeout
            
            ssize_t bytes_read = recv(client_socket, buffer, sizeof(buffer) - 1, 0);
            
            if (bytes_read <= 0) break;  // Connection closed or error
            
            buffer[bytes_read] = '\0';
            accumulated += buffer;
            
            // Process complete JSON messages (newline-delimited)
            size_t pos;
            while ((pos = accumulated.find('\n')) != std::string::npos) {
                std::string line = accumulated.substr(0, pos);
                accumulated = accumulated.substr(pos + 1);
                
                if (!line.empty()) {
                    process_input_command(line);
                }
            }
        }
    }
    
    void process_input_command(const std::string& cmd_str) {
        try {
            json cmd = json::parse(cmd_str);
            
            // Queue the command for processing in simulation thread
            std::lock_guard<std::mutex> lock(input_queue_mutex);
            input_queue.push(cmd);
            
        } catch (json::parse_error& e) {
            std::cerr << "⚠️  Failed to parse input command: " << e.what() << std::endl;
        }
    }
    
    void process_queued_inputs() {
        std::lock_guard<std::mutex> lock(input_queue_mutex);
        
        while (!input_queue.empty()) {
            json cmd = input_queue.front();
            input_queue.pop();
            
            try {
                std::string type = cmd.value("type", "");
                
                if (type == "spike") {
                    inject_spike(cmd);
                }
                else if (type == "current") {
                    inject_current(cmd);
                }
                else if (type == "stop") {
                    std::cout << "⏸️  Stop command received from input provider" << std::endl;
                    simulation_active = false;
                }
                
            } catch (std::exception& e) {
                std::cerr << "⚠️  Error processing input: " << e.what() << std::endl;
            }
        }
    }
    
    void inject_spike(const json& cmd) {
        std::string neuron_id = cmd.value("neuron_id", "");
        // float time = cmd.value("time", 0.0f);
        
        // TODO: Implement spike injection into GeNN model
        // This requires access to spike queues and manual spike insertion
        std::cout << "⚡ Spike injection request for " << neuron_id << " (not yet implemented)" << std::endl;
    }
    
    void inject_current(const json& cmd) {
        std::string neuron_id = cmd.value("neuron_id", "");
        float value = cmd.value("value", 0.0f);
        
        // TODO: Implement current injection into GeNN model
        // This requires modifying the Ioffset parameter or adding to input current
        std::cout << "⚡ Current injection request: " << neuron_id << " = " << value << "nA (not yet implemented)" << std::endl;
    }
    
    void run() {
        // Start TCP input server
        if (!start_tcp_server()) {
            std::cerr << "❌ Failed to start TCP input server, continuing without input" << std::endl;
        }
        
        // Start TCP server thread
        std::thread tcp_thread([this]() {
            if (tcp_listening) {
                this->tcp_server_loop();
            }
        });
        
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
                // Process any queued input commands
                process_queued_inputs();
                
                // Run simulation step
                run_simulation_step();
            } else {
                std::this_thread::sleep_for(std::chrono::milliseconds(10));
            }
        }
        
        tcp_listening = false;
        tcp_thread.join();
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
        step_time_fn(timestep, 1);  // timestep and numRecordingTimesteps
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
        std::cerr << "Usage: " << argv[0] << " <model_path> <ws_port> [input_port]" << std::endl;
        std::cerr << "Example: " << argv[0] << " /tmp/genn_models_xyz/user_network_CODE 9002 9001" << std::endl;
        return 1;
    }
    
    std::string model_path = argv[1];
    int ws_port = std::stoi(argv[2]);
    int input_port = (argc >= 4) ? std::stoi(argv[3]) : 9001;  // Default to 9001
    
    std::cout << "═══════════════════════════════════════════════════════" << std::endl;
    std::cout << "  GeNN Streaming Runner (PUSH Mode)" << std::endl;
    std::cout << "═══════════════════════════════════════════════════════" << std::endl;
    
    try {
        GeNNStreamingRunner runner(ws_port, input_port);
        
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
