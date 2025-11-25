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

type GeNNMessage = MetadataMessage | SpikeMessage | VoltageMessage;

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
  
  // Stats
  messageRate: number;  // Messages per second
  skippedFrames: number;  // Total frames skipped due to backpressure
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
  
  const wsRef = useRef<WebSocket | null>(null);
  const messageQueueRef = useRef<GeNNMessage[]>([]);
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
      
      // Strategy: Keep only the LAST voltage message, accumulate all spikes
      let latestVoltage: VoltageMessage | null = null;
      const accumulatedSpikes: string[] = [];
      
      // Process all queued messages
      for (const msg of queue) {
        if (msg.type === 'voltage') {
          // Keep only latest voltage
          if (latestVoltage) {
            setSkippedFrames(prev => prev + 1);  // Count skipped frames
          }
          latestVoltage = msg;
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
      
      // Apply updates
      if (latestVoltage) {
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
        processMessages();
      }
    });
  }, []);
  
  /**
   * Handle incoming WebSocket message
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg: GeNNMessage = JSON.parse(event.data);
      
      // Add to queue
      messageQueueRef.current.push(msg);
      
      // Update message rate stats
      messageCountRef.current++;
      const now = Date.now();
      if (now - lastRateUpdateRef.current >= 1000) {
        setMessageRate(messageCountRef.current);
        messageCountRef.current = 0;
        lastRateUpdateRef.current = now;
      }
      
      // Trigger processing
      processMessages();
    }
    catch (error) {
      console.error('Failed to parse GeNN message:', error);
    }
  }, [processMessages]);
  
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
      wsRef.current.send(JSON.stringify({ action: 'start' }));
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
      wsRef.current.send(JSON.stringify({ action: 'stop' }));
      setRunning(false);
      console.log('⏸️  Simulation stopped');
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
    messageRate,
    skippedFrames,
  };
}

/**
 * Example usage in a component:
 * 
 * ```tsx
 * function NetworkVisualizer() {
 *   const { 
 *     connect, disconnect, start, stop, 
 *     voltages, spikes, currentTime, 
 *     connected, running 
 *   } = useGeNNStream();
 *   
 *   useEffect(() => {
 *     connect('ws://localhost:9002');
 *     return () => disconnect();
 *   }, [connect, disconnect]);
 *   
 *   return (
 *     <div>
 *       <button onClick={start} disabled={!connected || running}>
 *         Start
 *       </button>
 *       <button onClick={stop} disabled={!running}>
 *         Stop
 *       </button>
 *       
 *       <div>Time: {currentTime.toFixed(1)}ms</div>
 *       
 *       {Array.from(voltages.entries()).map(([id, v]) => (
 *         <div key={id}>
 *           {id}: {v.toFixed(2)}mV 
 *           {spikes.includes(id) && <span>⚡</span>}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
