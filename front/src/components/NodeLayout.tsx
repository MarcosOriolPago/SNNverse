import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type OnConnect,
} from '@xyflow/react';
import { useGeNNStream } from '../hooks/useGeNNStream';
import { nanoid } from 'nanoid';
import { FiPlay, FiStopCircle } from 'react-icons/fi';
import { VisualizationConfig } from '../config/visualization';

import '@xyflow/react/dist/base.css';
import './../styles/lod-styles.css';
import './../styles/node-layout.css';
import './../styles/speed-selector.css';

import NeuronNode, { type NeuronNodeData } from './blocks/NeuronNode';
import InputNodeComponent, { type InputNodeData } from './blocks/InputNode';
import Axon from './Axon';
import SpikeRatePopup from './SpikeRatePopup';
import { eventBus } from '../utils/EventBus';

const initialNodes: Node<NeuronNodeData | InputNodeData>[] = [
  {
    id: 'input1',
    type: 'input',
    position: { x: 100, y: 100 },
    data: {
      initialCode: `def spike_function(t, ctx):\n    import random\n    return random.random() > 0.5`,
      custom_function: `def spike_function(t, ctx):\n    import random\n    return random.random() > 0.5`,
      currentValue: 'Ready',
      label: 'Python Generator'
    },
  },
  {
    id: 'neuron1',
    type: 'neuron',
    position: { x: 400, y: 100 },
    data: {
      voltage: -70.0,
      parameters: { type: 'LIF' }
    },
  }
];
const initialEdges: Edge[] = [
  { id: 'e1', source: 'input1', target: 'neuron1', type: 'spike' }
];

const nodeTypes = {
  neuron: NeuronNode,
  input: InputNodeComponent,
};

const edgeTypes = { spike: Axon };

const defaultEdgeOptions = {
  type: 'spike',
  markerEnd: 'edge-circle',
  style: { strokeWidth: 1, stroke: '#b1b1b7', strokeDasharray: '5, 5', strokeOpacity: 0.5 },
  data: {
    spikeSpeed: 1.5, // seconds - slowed down to be clearly visible
    spikeSize: 8,    // pixels - made larger for better visibility
  },
};

const FlowContent = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow();
  const [isCompiling, setIsCompiling] = useState(false);
  const [isCompiled, setIsCompiled] = useState(false);
  const [networkLoaded, setNetworkLoaded] = useState(false); // Track if network loaded in backend
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const {
    connect,
    disconnect,
    voltages,
    spikes,
    connected,
    running,
    start,
    stop,
    setSpeed,
    currentSpeed,
  } = useGeNNStream();

  const spikeCountsRef = useRef<Map<string, number>>(new Map());
  const lastResetTimeRef = useRef<number>(Date.now());
  const [searchParams] = useSearchParams();
  const networkName = searchParams.get('networkName');
  const shouldLoadConfig = searchParams.get('loadConfig') === 'true';

  // Load saved network configuration if loadConfig is true
  useEffect(() => {
    if (shouldLoadConfig && networkName) {
      const loadSavedNetwork = async () => {
        try {
          const response = await fetch(`http://localhost:8000/api/network/load_saved/${encodeURIComponent(networkName)}`);
          const data = await response.json();

          if (data.status === 'success' && data.network) {
            const savedNetwork = data.network;

            // Check if network is already compiled
            if (data.is_compiled) {
              console.log('✓ Network is already compiled, enabling Run button');
              setIsCompiled(true);
            } else {
              console.log('⚠ Network not compiled, will require compilation');
            }

            // Restore nodes with positions
            const restoredNodes = savedNetwork.nodes.map((node: any) => {
              if (node.type === 'PYTHON') {
                return {
                  id: node.id,
                  type: 'input',
                  position: node.position || { x: 100, y: 100 },
                  data: {
                    initialCode: node.params.custom_function || '',
                    custom_function: node.params.custom_function || '',
                    currentValue: 'Ready',
                    label: 'Python Generator'
                  }
                };
              } else {
                return {
                  id: node.id,
                  type: 'neuron',
                  position: node.position || { x: 400, y: 100 },
                  data: {
                    voltage: -70.0,
                    parameters: { ...node.params, type: node.type }
                  }
                };
              }
            });

            // Restore edges
            const restoredEdges = savedNetwork.edges.map((edge: any, idx: number) => ({
              id: `e${idx}`,
              source: edge.source,
              target: edge.target,
              type: 'spike'
            }));

            setNodes(restoredNodes);
            setEdges(restoredEdges);

            console.log('✓ Network configuration loaded:', networkName);
          }
        } catch (error) {
          console.error('Error loading saved network:', error);
        }
      };

      loadSavedNetwork();
    }
  }, [shouldLoadConfig, networkName, setNodes, setEdges]);

  useEffect(() => {
    connect('ws://localhost:9002');
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only connect once on mount


  // Update neuron voltages from C++ backend
  useEffect(() => {
    setNodes((nds) => nds.map((node) => {
      const voltage = voltages.get(node.id);
      if (voltage !== undefined) {
        return {
          ...node,
          data: {
            ...node.data,
            voltage: voltage  // Store as number, not string
          }
        };
      }
      return node;
    }));
  }, [voltages, setNodes]);

  // Aggregate spikes for rate calculation
  useEffect(() => {
    if (spikes.length === 0) return;

    const currentEdges = getEdges();
    spikes.forEach((sourceId) => {
      currentEdges.forEach((edge) => {
        if (edge.source === sourceId) {
          const count = spikeCountsRef.current.get(edge.id) || 0;
          spikeCountsRef.current.set(edge.id, count + 1);
        }
      });
    });
  }, [spikes, getEdges]);

  // Periodically emit spike rates to event bus (existing code)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastResetTimeRef.current) / 1000;

      spikeCountsRef.current.forEach((count, edgeId) => {
        const spikeRate = count / elapsed;
        eventBus.emit({ edgeId, spikeRate });
      });

      spikeCountsRef.current.clear();
      lastResetTimeRef.current = now;
    }, 1000);  // Update every second

    return () => clearInterval(interval);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    // Disable drop during simulation or compilation
    event.dataTransfer.dropEffect = (running || isCompiling) ? 'none' : 'move';
  }, [running, isCompiling]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      // Block adding nodes during simulation or compilation
      if (running || isCompiling) {
        console.warn('Cannot add nodes while simulation is running or compiling');
        return;
      }

      const typeData = event.dataTransfer.getData('application/reactflow');
      if (!typeData) return;

      const parsedData = JSON.parse(typeData);
      const { nodeType = 'neuron', neuronType, parameters } = parsedData;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let newNode: Node<NeuronNodeData | InputNodeData>;

      if (nodeType === 'input' || nodeType === 'python-input') {
        const defaultCode = `def spike_function(t, ctx):\n    # Return True for spike, False for no spike\n    # t = current timestep, ctx = context dictionary\n    import random\n    return random.random() > 0.5`;
        newNode = {
          id: nanoid(),
          type: 'input',
          position,
          data: {
            initialCode: defaultCode,
            custom_function: defaultCode,
            currentValue: 'Ready',
            label: 'Python Generator'
          },
        };
      } else {
        newNode = {
          id: nanoid(),
          type: 'neuron',
          position,
          data: {
            voltage: -70.0,  // Default resting voltage as NUMBER
            parameters: { ...parameters, type: neuronType }
          },
        };
      }

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes, running, isCompiling],
  );

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((els) => addEdge(params, els)),
    [setEdges],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!running) return; // Only show during simulation

      // Get node position on screen
      const nodeElement = document.querySelector(`[data-id="${node.id}"]`);
      if (nodeElement) {
        const rect = nodeElement.getBoundingClientRect();
        setPopupPosition({ x: rect.left, y: rect.top });
        setSelectedNodeId(node.id);
      }
    },
    [running],
  );

  const handleCompile = async () => {
    if (isCompiling || running) {
      console.warn('Cannot compile while compiling or running');
      return;
    }

    // Build network and compile model
    const currentNodes = getNodes();
    const currentEdges = getEdges();

    const payload = {
      nodes: currentNodes.map(n => {
        const isInputNode = n.type === 'input';
        return {
          id: n.id,
          type: isInputNode ? 'PYTHON' : ((n.data as NeuronNodeData).parameters?.type || 'LIF'),
          params: isInputNode
            ? { custom_function: (n.data as InputNodeData).custom_function || '' }
            : ((n.data as NeuronNodeData).parameters || {}),
          size: (n.data as NeuronNodeData).size || 1,
          position: n.position  // Include position for restoration
        };
      }),
      edges: currentEdges.map(e => ({
        source: e.source,
        target: e.target
      })),
      network_name: networkName || undefined  // Include network name from URL params
    };

    try {
      setIsCompiling(true);

      // Step 1: Build GeNN model (generates + compiles C++ runner)
      console.log('Building and compiling GeNN model...');
      const compileResponse = await fetch('http://localhost:8000/api/network/load_genn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!compileResponse.ok) {
        throw new Error('Failed to compile model');
      }

      // Step 2: Launch C++ runner and input providers (but don't start simulation yet)
      console.log('Starting C++ runner and input providers...');
      const startResponse = await fetch('http://localhost:8000/api/simulation/start_genn', {
        method: 'POST'
      });

      if (!startResponse.ok) {
        throw new Error('Failed to start C++ runner');
      }

      // Reconnect WebSocket to ensure we are talking to the new runner
      disconnect();
      setTimeout(() => {
        connect('ws://localhost:9002');
      }, 500);

      setIsCompiling(false);
      setIsCompiled(true);
      setNetworkLoaded(true); // Mark as loaded since compile also starts runner

      console.log('✓ Compilation complete. C++ runner ready. Press Run to start simulation.');
    } catch (error) {
      console.error("Failed to compile model", error);
      setIsCompiling(false);
      setIsCompiled(false);
    }
  };

  const handleRunStop = async () => {
    if (running) {
      // Stop simulation
      stop();
      return;
    }

    // If not compiled, show warning
    if (!isCompiled) {
      console.warn('Please compile the model first');
      return;
    }

    // Start simulation - but first ensure network is loaded into backend
    // Only load once per session (first run)
    try {
      console.log('Starting simulation...');

      // Check if we need to load the network first (for saved networks on FIRST run)
      if (!networkLoaded && shouldLoadConfig && networkName) {
        console.log('Loading compiled network into backend...');

        const currentNodes = getNodes();
        const currentEdges = getEdges();

        const payload = {
          nodes: currentNodes.map(n => {
            const isInputNode = n.type === 'input';
            return {
              id: n.id,
              type: isInputNode ? 'PYTHON' : ((n.data as NeuronNodeData).parameters?.type || 'LIF'),
              params: isInputNode
                ? { custom_function: (n.data as InputNodeData).custom_function || '' }
                : ((n.data as NeuronNodeData).parameters || {}),
              size: (n.data as NeuronNodeData).size || 1,
              position: n.position
            };
          }),
          edges: currentEdges.map(e => ({
            source: e.source,
            target: e.target
          })),
          network_name: networkName || undefined
        };

        // Load network (will skip compilation if already compiled)
        const compileResponse = await fetch('http://localhost:8000/api/network/load_genn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!compileResponse.ok) {
          throw new Error('Failed to load network');
        }

        console.log('✓ Network loaded (used cached compilation)');

        // Start the runner (only on first run)
        const startResponse = await fetch('http://localhost:8000/api/simulation/start_genn', {
          method: 'POST'
        });

        if (!startResponse.ok) {
          throw new Error('Failed to start runner');
        }

        // Reconnect WebSocket
        disconnect();
        setTimeout(() => {
          connect('ws://localhost:9002');
        }, 500);

        // Mark as loaded
        setNetworkLoaded(true);

        console.log('✓ Runner started');
      }

      // Start the simulation (always, even on subsequent runs)
      setTimeout(() => {
        start();
      }, networkLoaded ? 100 : 1000); // Faster on subsequent runs

      console.log('✓ Simulation started');
    } catch (error) {
      console.error('Failed to start simulation:', error);
    }
  };

  return (
    <div className="flow-wrapper" ref={wrapperRef}>
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button
          onClick={handleCompile}
          disabled={isCompiling || running}
          className={`run-button ${isCompiling ? 'compiling' : ''} ${isCompiled ? 'compiled' : ''}`}
        >
          {isCompiling ? (
            <>
              <div className="loading-spinner" />
              Compiling...
            </>
          ) : (
            <>
              <FiPlay />
              Compile
            </>
          )}
        </button>

        <button
          onClick={handleRunStop}
          disabled={!isCompiled || isCompiling}
          className={`run-button ${running ? 'running' : 'stopped'}`}
        >
          {running ? (
            <>
              <FiStopCircle /> Stop
            </>
          ) : (
            <>
              <FiPlay /> Run
            </>
          )}
        </button>
      </div>

      {/* Modern Speed Control Panel - Top Left */}
      {running && (
        <div className="speed-panel">
          {/* Header with Speed Indicator */}
          <div className="speed-header">
            <div className="speed-header-left">
              <div className="speed-icon">
                <svg className="speed-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="speed-title">
                <h4>Simulation Speed</h4>
                <p>Real-time control</p>
              </div>
            </div>
            <div className="speed-display">
              <div className="speed-number">
                {currentSpeed.toFixed(1)}x
              </div>
              <div className="speed-multiplier">Multiplier</div>
            </div>
          </div>

          {/* Visual Speed Bar */}
          <div className="speed-bar">
            <div
              className="speed-bar-fill"
              style={{ width: `${Math.min((currentSpeed / 10) * 100, 100)}%` }}
            />
          </div>

          {/* Speed Slider */}
          <div className="speed-slider-container">
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={currentSpeed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="speed-slider-input"
              style={{
                background: `linear-gradient(to right, rgb(59, 130, 246) 0%, rgb(168, 85, 247) ${(currentSpeed / 10) * 100}%, rgb(55, 65, 81) ${(currentSpeed / 10) * 100}%)`
              }}
            />
            <div className="speed-slider-labels">
              <span>Slow</span>
              <span>Normal</span>
              <span>Fast</span>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="speed-presets">
            {[0.5, 1.0, 2.0, 5.0].map((speed) => (
              <button
                key={speed}
                onClick={() => setSpeed(speed)}
                className={`preset-button ${Math.abs(currentSpeed - speed) < 0.05
                  ? 'active'
                  : ''
                  }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Info Text */}
          <div className="speed-info">
            <p>
              {currentSpeed < 1 ? '🐌 Slow motion mode' : currentSpeed === 1 ? '⚡ Normal speed' : '🚀 Fast forward mode'}
            </p>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        onlyRenderVisibleElements={nodes.length > 100}  // Optimize for large networks
        nodesDraggable={!running && !isCompiling}  // Disable dragging during simulation
        nodesConnectable={!running && !isCompiling}  // Disable connecting during simulation
        nodesFocusable={!running && !isCompiling}  // Disable node focus during simulation
        edgesFocusable={!running && !isCompiling}  // Disable edge focus during simulation
        elementsSelectable={!running && !isCompiling}  // Disable selection during simulation
        selectionOnDrag={!running && !isCompiling}  // Enable area selection by dragging
        panOnDrag={[1, 2]}  // Pan with middle or right mouse button
        panActivationKeyCode="Control"  // Require Ctrl key for panning with left mouse button
        deleteKeyCode={['Backspace', 'Delete']}  // Enable deletion with Delete/Backspace keys
        className="react-flow-background"
      >
        <Controls className="react-flow-controls" />
        <Background color="#6d6d6dff" gap={16} />
      </ReactFlow>

      {selectedNodeId && (
        <SpikeRatePopup
          nodeId={selectedNodeId}
          position={popupPosition}
          onClose={() => setSelectedNodeId(null)}
          edges={edges.map(e => ({ id: e.id, source: e.source, target: e.target }))}
        />
      )}
    </div>
  );
};

export default function NodeFlowLayout() {
  return (
    <ReactFlowProvider>
      <FlowContent />
    </ReactFlowProvider>
  );
}