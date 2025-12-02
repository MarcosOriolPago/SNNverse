import re
import os

class GeNNRunnerGenerator:
    def __init__(self, code_dir, num_neurons_per_group=1):
        self.code_dir = code_dir
        self.num_neurons = num_neurons_per_group
        self.sigs = []

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
            
            # We only care about NeuronUpdate groups for offsets (usually)
            # But let's just track offsets for all groups that have 'V' (neurons)
            has_voltage = any(arg['name'] == 'V' for arg in sig['args'])
            if has_voltage:
                group_offsets[group_id] = current_offset
                current_offset += size
            
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

            push_calls += f"    {func_name}({', '.join(call_args)});\n"

        # Generate metadata JSON
        import json as json_lib
        metadata = {
            "type": "metadata",
            "dt": 0.1,
            "voltage_interval_ms": 10.0, # Matches throttle
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
            if has_voltage:
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
#include <websocketpp/config/asio_no_tls.hpp>
#include <websocketpp/server.hpp>
#include <nlohmann/json.hpp>

using json = nlohmann::json;
typedef websocketpp::server<websocketpp::config::asio> WsServer;
using websocketpp::connection_hdl;

// --- Globals
std::atomic<bool> running(true);
std::atomic<bool> simulation_active(false);
std::set<connection_hdl, std::owner_less<connection_hdl>> connections;
std::mutex connection_mutex;
WsServer server;

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
    } catch (const std::exception& e) {
        std::cerr << "Error parsing message: " << e.what() << std::endl;
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
            std::this_thread::sleep_for(std::chrono::milliseconds(10)); // Throttle
        } else {
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
    }
    
    // freeMem(); // Not implemented
}

int main() {
    try {
        // Set up WebSocket server
        server.set_access_channels(websocketpp::log::alevel::all);
        server.clear_access_channels(websocketpp::log::alevel::frame_payload);
        server.init_asio();
        
        server.set_open_handler(bind(&on_open, &server, std::placeholders::_1));
        server.set_close_handler(bind(&on_close, &server, std::placeholders::_1));
        server.set_message_handler(bind(&on_message, &server, std::placeholders::_1, std::placeholders::_2));
        
        server.listen(9002);
        server.start_accept();
        
        // Start simulation thread
        std::thread sim_thread(simulation_loop);
        
        std::cout << "Runner listening on port 9002" << std::endl;
        server.run();
        
        running = false;
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