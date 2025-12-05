import re
import os

from ..core.config import config

class GeNNRunnerGenerator:
    def __init__(self, code_dir, num_neurons_per_group=1, id_map=None):
        self.code_dir = code_dir
        self.num_neurons = num_neurons_per_group
        self.sigs = []
        self.id_map = id_map or {}

    def parse_generated_code(self):
        def_file = os.path.join(self.code_dir, "definitions.h")
        if not os.path.exists(def_file):
            print(f"Warning: definitions.h not found at {def_file}.")
            return
            
        pattern = re.compile(r"EXPORT_FUNC void (pushMerged\w+)\(unsigned int idx, (.*?)\);")
        with open(def_file, 'r') as f:
            content = f.read()
        
        matches = pattern.findall(content)
        for func_name, args_str in matches:
            args = []
            for arg in args_str.split(','):
                arg = arg.strip()
                parts = arg.rsplit(' ', 1)
                if len(parts) == 2:
                    args.append({'type': parts[0].strip(), 'name': parts[1].replace('*', '').strip()})
            self.sigs.append({
                'func_name': func_name,
                'args': args,
                'group_id': func_name.replace('pushMerged', '').replace('ToDevice', '')
            })

        group_sizes = {}
        size_pattern = re.compile(r"static Merged(\w+) \w+\[(\d+)\];")
        for filename in ["init.cc", "neuronUpdate.cc", "synapseUpdate.cc"]:
            filepath = os.path.join(self.code_dir, filename)
            if os.path.exists(filepath):
                with open(filepath, 'r') as f:
                    content = f.read()
                    for group_name, size in size_pattern.findall(content):
                        group_sizes[group_name] = int(size)
        
        for sig in self.sigs:
            sig['size'] = group_sizes.get(sig['group_id'], 1)
    
    def _generate_neuron_mapping(self):
        """
        Generate C++ code to initialize the neuron_id_to_group mapping.
        This maps original neuron IDs to their GeNN group IDs.
        """
        mapping_code = ""
        
        # Use the provided ID map if available
        if self.id_map:
            for original_id, sanitized_id in self.id_map.items():
                mapping_code += f'        neuron_id_to_group["{original_id}"] = "{sanitized_id}";\n'
        else:
            # Fallback for backward compatibility
            for sig in self.sigs:
                group_id = sig['group_id']
                mapping_code += f'        neuron_id_to_group["{group_id}"] = "{group_id}";\n'
        
        return mapping_code

    def generate_runner_code(self):
        """
        Generates a standalone C++ WebSocket runner for the GeNN model.
        """
        
        # Generate variable declarations and push calls
        var_decls = ""
        push_calls = ""
        
        # Data collection logic
        collect_voltages = ""
        collect_spikes = ""
        
        # Calculate offsets for global neuron IDs
        group_offsets = {}
        current_offset = 0
        
        # First pass to calculate offsets and declare variables
        for sig in self.sigs:
            func_name = sig['func_name']
            group_id = sig['group_id']
            size = sig['size']
            
            if size == 0: continue
            
            # Check if group should be included in frontend visualization
            # Include if it has Voltage (standard neuron) OR Spikes (input/spike source)
            has_voltage = any(arg['name'] == 'V' for arg in sig['args'])
            has_spikes = any('spk' in arg['name'].lower() or 'spike' in arg['name'].lower() for arg in sig['args'])
            
            should_include = has_voltage or has_spikes
            
            if should_include:
                group_offsets[group_id] = current_offset
                current_offset += size
                
                # If no voltage variable, inject dummy voltages (zeros) to maintain alignment
                if not has_voltage:
                    collect_voltages += f"""
            for(int i=0; i<{size}; i++) all_voltages.push_back(0.0f);
"""
            
            # For each argument (except idx), allocate memory
            call_args = ["0"] # idx = 0
            
            for arg in sig['args']:
                var_name = arg['name']
                var_type = arg['type']
                
                # Create global vector
                global_name = f"var_{group_id}_{var_name}"
                vec_type = var_type.replace("*", "").strip()
                
                var_decls += f"std::vector<{vec_type}> {global_name}({size});\n"
                call_args.append(f"{global_name}.data()")
                
                # Voltage collection
                if var_name == "V":
                    collect_voltages += f"""
            for(auto val : {global_name}) all_voltages.push_back(val);
"""
                    # Add to voltage map
                    push_calls += f'    group_voltage_map["{group_id}"] = &{global_name};\n'
            
            # Spike collection
            # Check if this group has spike count and spike array
            args_names = [a['name'] for a in sig['args']]
            if 'spkCntSynSpike0' in args_names and 'spkSynSpike0' in args_names:
                cnt_var = f"var_{group_id}_spkCntSynSpike0"
                spk_var = f"var_{group_id}_spkSynSpike0"
                offset = group_offsets.get(group_id, 0)
                
                collect_spikes += f"""
            {{
                uint32_t count = {cnt_var}[0];
                for(uint32_t i=0; i<count; i++) {{
                    all_spikes.push_back({spk_var}[i] + {offset});
                }}
            }}
"""

            # Spike Source registration
            if 'spikeTimes' in args_names and 'startSpike' in args_names and 'endSpike' in args_names:
                st_var = f"var_{group_id}_spikeTimes"
                ss_var = f"var_{group_id}_startSpike"
                es_var = f"var_{group_id}_endSpike"
                push_calls += f'    group_spike_source_map["{group_id}"] = {{&{st_var}, &{ss_var}, &{es_var}}};\n'

            push_calls += f"    {func_name}({', '.join(call_args)});\n"

        # Generate metadata JSON
        import json as json_lib
        metadata = {
            "type": "metadata",
            "dt": 0.1,
            "voltage_interval_ms": 10.0, # Matches throttle
            "speed": 1.0,  # Default simulation speed multiplier
            "neurons": []
        }
        
        # We need to preserve the order of groups as they appear in the binary array
        # The binary array order is determined by the loop over self.sigs
        # But we only included groups with 'V' in the binary array
        
        for sig in self.sigs:
            group_id = sig['group_id']
            size = sig['size']
            if size == 0: continue
            
            has_voltage = any(arg['name'] == 'V' for arg in sig['args'])
            has_spikes = any('spk' in arg['name'].lower() or 'spike' in arg['name'].lower() for arg in sig['args'])
            
            should_include = has_voltage or has_spikes
            
            if should_include:
                metadata["neurons"].append({
                    "id": group_id,
                    "name": group_id,
                    "size": size
                })
        
        metadata_json = json_lib.dumps(metadata)

        code = """
#include "definitions.h"
#include <iostream>
#include <vector>
#include <thread>
#include <atomic>
#include <chrono>
#include <cstring>
#include <set>
#include <mutex>
#include <queue>
#include <map>
#include <websocketpp/config/asio_no_tls.hpp>
#include <websocketpp/server.hpp>
#include <nlohmann/json.hpp>
#include <boost/asio.hpp>

using json = nlohmann::json;
typedef websocketpp::server<websocketpp::config::asio> WsServer;
using websocketpp::connection_hdl;
using boost::asio::ip::tcp;

// --- Globals
std::atomic<bool> running(true);
std::atomic<bool> simulation_active(false);
std::atomic<float> simulation_speed(1.0f);  // Speed multiplier (0.1x to 10.0x)
std::set<connection_hdl, std::owner_less<connection_hdl>> connections;
std::mutex connection_mutex;
WsServer server;

// --- Spike Injection
struct SpikeCommand {
    std::string neuron_id;
    bool spike;
    int index;
};

std::queue<SpikeCommand> spike_queue;
std::mutex spike_queue_mutex;
std::map<std::string, std::string> neuron_id_to_group;  // original_id -> group_id
std::map<std::string, std::vector<float>*> group_voltage_map; // group_id -> voltage_vector

struct SpikeSourceVars {
    std::vector<float>* spikeTimes;
    std::vector<uint32_t>* startSpike;
    std::vector<uint32_t>* endSpike;
};
std::map<std::string, SpikeSourceVars> group_spike_source_map; // group_id -> vars

// --- GeNN Variables
""" + var_decls + """

// --- Metadata
std::string metadata_json = R"(""" + metadata_json + """)";

// --- WebSocket Handlers
void on_open(WsServer* s, connection_hdl hdl) {
    std::lock_guard<std::mutex> lock(connection_mutex);
    connections.insert(hdl);
    std::cout << "Client connected" << std::endl;
    
    // Send metadata
    try {
        s->send(hdl, metadata_json, websocketpp::frame::opcode::text);
    } catch (...) {}
}

void on_close(WsServer* s, connection_hdl hdl) {
    std::lock_guard<std::mutex> lock(connection_mutex);
    connections.erase(hdl);
    std::cout << "Client disconnected" << std::endl;
}

void on_message(WsServer* s, connection_hdl hdl, WsServer::message_ptr msg) {
    try {
        auto payload = json::parse(msg->get_payload());
        std::string command = payload["command"];
        
        if (command == "start") {
            simulation_active = true;
            std::cout << "Simulation started" << std::endl;
        }
        else if (command == "stop") {
            simulation_active = false;
            std::cout << "Simulation stopped" << std::endl;
        }
        else if (command == "set_speed") {
            float speed = payload.value("speed", 1.0f);
            // Clamp speed to reasonable range
            speed = std::max(0.1f, std::min(10.0f, speed));
            simulation_speed = speed;
            std::cout << "Simulation speed set to " << speed << "x" << std::endl;
            
            // Broadcast speed change to all clients
            json response = {
                {"type", "speed_update"},
                {"speed", speed}
            };
            std::string response_str = response.dump();
            std::lock_guard<std::mutex> lock(connection_mutex);
            for (auto hdl : connections) {
                try {
                    s->send(hdl, response_str, websocketpp::frame::opcode::text);
                } catch (...) {}
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "Error parsing message: " << e.what() << std::endl;
    }
}

// --- TCP Spike Injection Handler
void tcp_spike_handler(uint16_t port) {
    try {
        boost::asio::io_context io_context;
        tcp::acceptor acceptor(io_context, tcp::endpoint(tcp::v4(), port));
        
        std::cout << "TCP spike injection server listening on port " << port << std::endl;
        
        while (running) {
            tcp::socket socket(io_context);
            acceptor.accept(socket);
            
            std::cout << "TCP client connected for spike injection" << std::endl;
            
            // Read spike commands
            while (running && socket.is_open()) {
                try {
                    boost::asio::streambuf buffer;
                    boost::asio::read_until(socket, buffer, '\\n');
                    
                    std::istream is(&buffer);
                    std::string line;
                    std::getline(is, line);
                    
                    // Parse JSON command
                    auto cmd = json::parse(line);
                    std::string neuron_id = cmd["neuron_id"];
                    bool spike = cmd.value("spike", false);
                    int index = cmd.value("index", 0);
                    
                    // Add to queue
                    {
                        std::lock_guard<std::mutex> lock(spike_queue_mutex);
                        spike_queue.push({neuron_id, spike, index});
                    }
                    
                    std::cout << "Spike command received: " << neuron_id << " -> " << spike << std::endl;
                    
                } catch (const std::exception& e) {
                    std::cerr << "TCP error: " << e.what() << std::endl;
                    break;
                }
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "TCP server error: " << e.what() << std::endl;
    }
}

// --- Simulation Loop
void simulation_loop() {
    std::cout << "Simulation loop started" << std::endl;
    
    // Initialize GeNN
    // allocateMem(); // Not implemented for this backend
    
    // Register our allocated memory with GeNN
""" + push_calls + """
    
    initialize();
    initializeSparse();
    
    unsigned long long t_idx = 0;
    float t = 0.0f;
    
    while (running) {
        if (simulation_active) {
            // Process injected spikes from TCP
            {
                std::lock_guard<std::mutex> lock(spike_queue_mutex);
                while (!spike_queue.empty()) {
                    SpikeCommand cmd = spike_queue.front();
                    spike_queue.pop();
                    
                    // Map neuron_id to group_id
                    auto it = neuron_id_to_group.find(cmd.neuron_id);
                    if (it != neuron_id_to_group.end()) {
                        std::string group_id = it->second;
                        
                        // Inject spike by forcing voltage > threshold
                        auto v_it = group_voltage_map.find(group_id);
                        if (v_it != group_voltage_map.end()) {
                            if (cmd.spike) {
                                std::vector<float>* voltages = v_it->second;
                                if (cmd.index >= 0 && cmd.index < voltages->size()) {
                                    (*voltages)[cmd.index] = 100.0f; // Force spike
                                }
                            }
                        } else {
                             // Try spike source map
                             auto ss_it = group_spike_source_map.find(group_id);
                             if (ss_it != group_spike_source_map.end()) {
                                 if (cmd.spike) {
                                     SpikeSourceVars& vars = ss_it->second;
                                     if (cmd.index >= 0 && cmd.index < vars.spikeTimes->size()) {
                                         // Schedule spike for NOW (t)
                                         // We reuse the 0-th slot for single-spike injection per step
                                         (*vars.spikeTimes)[cmd.index] = t; 
                                         (*vars.startSpike)[cmd.index] = 0; // Reset start
                                         (*vars.endSpike)[cmd.index] = 1;   // One spike to process
                                         std::cout << "Injected spike (source) for " << cmd.neuron_id << " at t=" << t << std::endl;
                                     }
                                 }
                             } else {
                                 std::cerr << "No voltage array or spike source for group: " << group_id << std::endl;
                             }
                        }
                    } else {
                        std::cerr << "Unknown neuron ID: " << cmd.neuron_id << std::endl;
                    }
                }
            }
            
            // Step GeNN
            updateNeurons(t, 0);
            updateSynapses(t);
            
            // Collect Data
            std::vector<float> all_voltages;
            std::vector<uint32_t> all_spikes;
            
""" + collect_voltages + """
""" + collect_spikes + """
            
            // Prepare Binary Packet
            // Header: [Time(4B)][Step(4B)][SpikeCount(4B)][VoltageCount(4B)]
            // Body: [Spikes...][Voltages...]
            
            uint32_t step_u32 = (uint32_t)t_idx;
            uint32_t spike_count = (uint32_t)all_spikes.size();
            uint32_t voltage_count = (uint32_t)all_voltages.size();
            
            size_t header_size = 16;
            size_t body_size = (spike_count * 4) + (voltage_count * 4);
            size_t total_size = header_size + body_size;
            
            std::vector<uint8_t> buffer(total_size);
            uint8_t* ptr = buffer.data();
            
            // Write Header
            memcpy(ptr, &t, 4); ptr += 4;
            memcpy(ptr, &step_u32, 4); ptr += 4;
            memcpy(ptr, &spike_count, 4); ptr += 4;
            memcpy(ptr, &voltage_count, 4); ptr += 4;
            
            // Write Spikes
            if (spike_count > 0) {
                memcpy(ptr, all_spikes.data(), spike_count * 4);
                ptr += spike_count * 4;
            }
            
            // Write Voltages
            if (voltage_count > 0) {
                memcpy(ptr, all_voltages.data(), voltage_count * 4);
                ptr += voltage_count * 4;
            }
            
            // Broadcast to clients
            if (!connections.empty()) {
                std::lock_guard<std::mutex> lock(connection_mutex);
                for (auto hdl : connections) {
                    try {
                        server.send(hdl, buffer.data(), buffer.size(), websocketpp::frame::opcode::binary);
                    } catch (...) {}
                }
            }
            
            t += 0.1f; // Assuming dt = 0.1
            t_idx++;
            
            // Dynamic sleep based on simulation speed
            float current_speed = simulation_speed.load();
            int sleep_ms = static_cast<int>(10.0f / current_speed);
            sleep_ms = std::max(1, sleep_ms); // Minimum 1ms to avoid busy-waiting
            std::this_thread::sleep_for(std::chrono::milliseconds(sleep_ms));
        } else {
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
    }
    
    // freeMem(); // Not implemented
}

int main() {
    try {
        // Initialize neuron ID mapping
""" + self._generate_neuron_mapping() + """
        
        // Set up WebSocket server
        server.set_access_channels(websocketpp::log::alevel::all);
        server.clear_access_channels(websocketpp::log::alevel::frame_payload);
        server.init_asio();
        
        server.set_open_handler(bind(&on_open, &server, std::placeholders::_1));
        server.set_close_handler(bind(&on_close, &server, std::placeholders::_1));
        server.set_message_handler(bind(&on_message, &server, std::placeholders::_1, std::placeholders::_2));
        
        server.listen(""" + str(config.WEBSOCKET_PORT) + """);
        server.start_accept();
        
        // Start TCP spike injection server
        std::thread tcp_thread(tcp_spike_handler, """ + str(config.INPUT_TCP_PORT) + """);
        
        // Start simulation thread
        std::thread sim_thread(simulation_loop);
        
        std::cout << "Runner listening on port """ + str(config.WEBSOCKET_PORT) + """ (WebSocket)" << std::endl;
        std::cout << "TCP spike injection on port """ + str(config.INPUT_TCP_PORT) + """ " << std::endl;
        server.run();
        
        running = false;
        tcp_thread.join();
        sim_thread.join();
        
    } catch (websocketpp::exception const & e) {
        std::cout << e.what() << std::endl;
    } catch (...) {
        std::cout << "other exception" << std::endl;
    }
    
    return 0;
}
"""
        return code

    def write_runner(self):
        """
        Write the generated runner code to runner.cc in the code directory.
        """
        self.parse_generated_code()
        code = self.generate_runner_code()
        
        runner_path = os.path.join(self.code_dir, "runner.cc")
        with open(runner_path, 'w') as f:
            f.write(code)
        
        print(f"✓ Generated runner code at {runner_path}")