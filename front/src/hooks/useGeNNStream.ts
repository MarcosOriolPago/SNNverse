/**
 * useGeNNStream - React Hook for Push-Based GeNN WebSocket
 * 
 * Intelligently handles continuous stream from C++ backend:
 * - Only processes freshest data (skips old frames if overwhelmed)
 * - Automatically manages connection lifecycle
 * - Provides clean API for React components
 * 
 * Usage:
 * ```tsx
 * const { connect, disconnect, start, stop, voltages, spikes, metadata } = useGeNNStream();
 * 
 * useEffect(() => {
 *   connect('ws://localhost:9002');
 *   return () => disconnect();
 * }, []);
 * ```
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// Message types from C++ backend
interface MetadataMessage {
  type: 'metadata';
  dt: number;
  voltage_interval_ms: number;
  neurons: Array<{
    id: string;
    name: string;
    size: number;
  }>;
}

interface SpikeMessage {
  type: 'spike';
  t: number;
  ids: string[];
}

interface VoltageMessage {
  type: 'voltage';
  t: number;
  step: number;
  neurons: Array<{
    id: string;
    v: number;
  }>;
}

// Internal binary update message (not part of public API)
interface BinaryUpdateMessage {
  type: 'binary_update';
  t: number;
  step: number;
  voltages: Map<string, number>;
  spikes: string[];
}

type GeNNMessage = MetadataMessage | SpikeMessage | VoltageMessage;
type InternalMessage = GeNNMessage | BinaryUpdateMessage;

// Hook state
interface UseGeNNStreamReturn {
  // Connection
  connected: boolean;
  connect: (url: string) => void;
  disconnect: () => void;

  // Simulation control
  start: () => void;
  stop: () => void;
  running: boolean;

  // Data
  metadata: MetadataMessage | null;
  voltages: Map<string, number>;  // neuron_id -> voltage
  spikes: string[];  // Recently spiked neuron IDs
  currentTime: number;  // Simulation time (ms)
  currentSpeed: number;  // Current simulation speed multiplier

  // Stats
  messageRate: number;  // Messages per second
  skippedFrames: number;  // Total frames skipped due to backpressure

  // Speed control
  setSpeed: (speed: number) => void;
}

/**
 * Custom hook for GeNN streaming connection
 */
export function useGeNNStream(): UseGeNNStreamReturn {
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const [metadata, setMetadata] = useState<MetadataMessage | null>(null);
  const [voltages, setVoltages] = useState<Map<string, number>>(new Map());
  const [spikes, setSpikes] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [messageRate, setMessageRate] = useState(0);
  const [skippedFrames, setSkippedFrames] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(1.0);

  const wsRef = useRef<WebSocket | null>(null);
  const messageQueueRef = useRef<InternalMessage[]>([]);
  const processingRef = useRef(false);
  const messageCountRef = useRef(0);
  const lastRateUpdateRef = useRef(Date.now());

  /**
   * Process incoming messages intelligently
   * - Keeps only latest voltage message
   * - Accumulates spikes
   * - Processes in batches to avoid UI freezing
   */
  const processMessages = useCallback(() => {
    if (processingRef.current || messageQueueRef.current.length === 0) {
      return;
    }

    processingRef.current = true;

    requestAnimationFrame(() => {
      const queue = messageQueueRef.current;

      if (queue.length === 0) {
        processingRef.current = false;
        return;
      }

      // Strategy: Keep only the LAST voltage/binary_update message, accumulate all spikes
      let latestVoltage: VoltageMessage | null = null;
      let latestBinary: BinaryUpdateMessage | null = null;
      const accumulatedSpikes: string[] = [];

      // Process all queued messages
      for (const msg of queue) {
        if (msg.type === 'voltage') {
          // Keep only latest voltage
          if (latestVoltage) {
            setSkippedFrames(prev => prev + 1);  // Count skipped frames
          }
          latestVoltage = msg;
          latestBinary = null; // Binary takes precedence if both exist
        }
        else if (msg.type === 'binary_update') {
          // Binary update - more efficient
          if (latestBinary) {
            setSkippedFrames(prev => prev + 1);
          }
          latestBinary = msg;
          latestVoltage = null; // Binary takes precedence
        }
        else if (msg.type === 'spike') {
          // Accumulate all spikes
          accumulatedSpikes.push(...msg.ids);
        }
        else if (msg.type === 'metadata') {
          setMetadata(msg);
        }
      }

      // Clear queue
      messageQueueRef.current = [];

      // Apply updates - prefer binary (already parsed)
      if (latestBinary) {
        setVoltages(latestBinary.voltages);
        setCurrentTime(latestBinary.t);

        // Binary messages include spikes
        if (latestBinary.spikes.length > 0) {
          accumulatedSpikes.push(...latestBinary.spikes);
        }
      }
      else if (latestVoltage) {
        const newVoltages = new Map<string, number>();
        latestVoltage.neurons.forEach(n => {
          newVoltages.set(n.id, n.v);
        });
        setVoltages(newVoltages);
        setCurrentTime(latestVoltage.t);
      }

      if (accumulatedSpikes.length > 0) {
        // Remove duplicates
        const uniqueSpikes = Array.from(new Set(accumulatedSpikes));
        setSpikes(uniqueSpikes);

        // Clear spikes after a short delay
        setTimeout(() => setSpikes([]), 100);
      }

      processingRef.current = false;

      // Continue processing if more messages arrived
      if (messageQueueRef.current.length > 0) {
        console.log('Message arrived')
        processMessages();
      }
    });
  }, []);

  /**
   * Handle incoming WebSocket message
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {

      // Handle Binary Data (Simulation Step)
      if (event.data instanceof ArrayBuffer) {
        const buffer = event.data;
        const view = new DataView(buffer);

        // Header (16 bytes)
        // [Time(4)][Step(4)][SpikeCount(4)][VoltageCount(4)]
        const t = view.getFloat32(0, true); // Little endian
        const step = view.getUint32(4, true);
        const spikeCount = view.getUint32(8, true);
        const voltageCount = view.getUint32(12, true);
        console.log(t, step, spikeCount, voltageCount);

        let offset = 16;

        // Read Spikes
        const spikeIds: string[] = [];
        if (spikeCount > 0) {
          if (metadata) {
            for (let i = 0; i < spikeCount; i++) {
              const spikeIndex = view.getUint32(offset + i * 4, true);
              if (spikeIndex < metadata.neurons.length) {
                spikeIds.push(metadata.neurons[spikeIndex].id);
              }
            }
          }
          offset += spikeCount * 4;
        }

        // Read Voltages
        const newVoltages = new Map<string, number>();
        if (voltageCount > 0 && metadata) {
          // Voltages are float32s
          for (let i = 0; i < voltageCount; i++) {
            const v = view.getFloat32(offset + i * 4, true);
            if (i < metadata.neurons.length) {
              newVoltages.set(metadata.neurons[i].id, v);
            }
          }
        }

        // Push binary update to queue
        messageQueueRef.current.push({
          type: 'binary_update',
          t,
          step,
          voltages: newVoltages,
          spikes: spikeIds
        } as any);

        // Update stats
        messageCountRef.current++;
        const now = Date.now();
        if (now - lastRateUpdateRef.current >= 1000) {
          setMessageRate(messageCountRef.current);
          messageCountRef.current = 0;
          lastRateUpdateRef.current = now;
        }

        processMessages();
      }
      // Handle Text Data (Metadata / JSON)
      else if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);

        if (msg.type === 'metadata') {
          setMetadata(msg);
          // Set initial speed from metadata
          if (msg.speed !== undefined) {
            setCurrentSpeed(msg.speed);
          }
        }
        else if (msg.type === 'speed_update') {
          // Update current speed when backend confirms change
          if (msg.speed !== undefined) {
            setCurrentSpeed(msg.speed);
          }
        }
        else if (msg.type === 'simulation_data') {
          // Handle Python simulation runtime data
          // Structure: { type, timestep, time, voltages: {id: [v...]}, spikes: {id: [idx...]} }

          const newVoltages = new Map<string, number>();
          const spikeIds: string[] = [];

          // Process voltages
          if (msg.voltages) {
            Object.entries(msg.voltages).forEach(([id, values]: [string, any]) => {
              // Take the first neuron's voltage for visualization if multiple exist
              // or average them. For now, first one is simple and fast.
              const v = Array.isArray(values) && values.length > 0 ? values[0] : values;
              if (typeof v === 'number') {
                newVoltages.set(id, v);
              }
            });
          }

          // Process spikes
          if (msg.spikes) {
            Object.entries(msg.spikes).forEach(([id, indices]: [string, any]) => {
              if (Array.isArray(indices) && indices.length > 0) {
                // If any neuron in the population spiked, mark the node as spiking
                spikeIds.push(id);
              }
            });
          }

          // Reuse binary_update structure for efficient processing
          messageQueueRef.current.push({
            type: 'binary_update',
            t: msg.time,
            step: msg.timestep,
            voltages: newVoltages,
            spikes: spikeIds
          });

          // Update stats
          messageCountRef.current++;
          const now = Date.now();
          if (now - lastRateUpdateRef.current >= 1000) {
            setMessageRate(messageCountRef.current);
            messageCountRef.current = 0;
            lastRateUpdateRef.current = now;
          }

          processMessages();
        }
      }
    }
    catch (error) {
      console.error('Failed to parse GeNN message:', error);
    }
  }, [processMessages, metadata]);

  /**
   * Connect to GeNN WebSocket server
   */
  const connect = useCallback((url: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.warn('Already connected to GeNN stream');
      return;
    }

    console.log('Connecting to GeNN stream:', url);

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer'; // Enable binary mode

    ws.onopen = () => {
      console.log('✓ Connected to GeNN stream');
      setConnected(true);
    };

    ws.onclose = () => {
      console.log('✗ Disconnected from GeNN stream');
      setConnected(false);
      setRunning(false);
    };

    ws.onerror = (error) => {
      console.error('GeNN WebSocket error:', error);
    };

    ws.onmessage = handleMessage;

    wsRef.current = ws;
  }, [handleMessage]);

  /**
   * Disconnect from GeNN WebSocket
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setConnected(false);
      setRunning(false);
    }
  }, []);

  /**
   * Start simulation
   */
  const start = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command: 'start' }));
      setRunning(true);
      setSkippedFrames(0);  // Reset stats
      console.log('▶️  Simulation started');
    }
  }, []);

  /**
   * Stop simulation
   */
  const stop = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command: 'stop' }));
      setRunning(false);
      console.log('⏸️  Simulation stopped');
    }
  }, []);

  /**
   * Set simulation speed
   */
  const setSpeed = useCallback((speed: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Clamp speed to reasonable range
      const clampedSpeed = Math.max(0.001, Math.min(10.0, speed));
      wsRef.current.send(JSON.stringify({ command: 'set_speed', speed: clampedSpeed }));
      setCurrentSpeed(clampedSpeed);
      console.log(`🎚️  Setting simulation speed to ${clampedSpeed.toFixed(3)}x`);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connected,
    connect,
    disconnect,
    start,
    stop,
    running,
    metadata,
    voltages,
    spikes,
    currentTime,
    currentSpeed,
    messageRate,
    skippedFrames,
    setSpeed,
  };
}