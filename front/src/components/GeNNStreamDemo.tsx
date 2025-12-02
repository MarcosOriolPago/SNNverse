/**
 * GeNNStreamDemo - Example Component
 * 
 * Demonstrates how to use the useGeNNStream hook with continuous push-based streaming.
 * Shows real-time voltage visualization and spike indicators.
 */

import React, { useEffect } from 'react';
import { useGeNNStream } from '../hooks/useGeNNStream';

export function GeNNStreamDemo() {
  const {
    connect,
    disconnect,
    start,
    stop,
    connected,
    running,
    voltages,
    spikes,
    currentTime,
    messageRate,
    skippedFrames,
    metadata,
  } = useGeNNStream();

  // Connect on mount
  useEffect(() => {
    connect('ws://localhost:9002');
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Helper to get voltage color based on value
  const getVoltageColor = (voltage: number): string => {
    // -70mV (rest) = blue, -55mV (threshold) = yellow, 30mV (spike) = red
    if (voltage > 0) return '#ff4444';  // Spiking
    if (voltage > -55) return '#ffaa00';  // Near threshold
    if (voltage > -65) return '#44ff44';  // Active
    return '#4444ff';  // Rest
  };

  // Helper to convert voltage to bar height (0-100%)
  const voltageToPercent = (voltage: number): number => {
    // Map -70mV to 0%, 30mV to 100%
    return Math.max(0, Math.min(100, ((voltage + 70) / 100) * 100));
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>GeNN Live Stream</h2>
        
        <div style={styles.controls}>
          <button 
            onClick={start} 
            disabled={!connected || running}
            style={{...styles.button, ...styles.startButton}}
          >
            ▶️ Start
          </button>
          
          <button 
            onClick={stop} 
            disabled={!running}
            style={{...styles.button, ...styles.stopButton}}
          >
            ⏸️ Stop
          </button>
        </div>

        <div style={styles.status}>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Connection:</span>
            <span style={{
              ...styles.statusValue,
              color: connected ? '#44ff44' : '#ff4444'
            }}>
              {connected ? '✓ Connected' : '✗ Disconnected'}
            </span>
          </div>
          
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Simulation:</span>
            <span style={{
              ...styles.statusValue,
              color: running ? '#44ff44' : '#888'
            }}>
              {running ? '▶️ Running' : '⏸️ Stopped'}
            </span>
          </div>
          
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Time:</span>
            <span style={styles.statusValue}>
              {currentTime.toFixed(1)} ms
            </span>
          </div>
        </div>

        <div style={styles.stats}>
          <div style={styles.statBox}>
            <div style={styles.statValue}>{messageRate}</div>
            <div style={styles.statLabel}>msg/sec</div>
          </div>
          
          <div style={styles.statBox}>
            <div style={styles.statValue}>{skippedFrames}</div>
            <div style={styles.statLabel}>skipped</div>
          </div>
          
          <div style={styles.statBox}>
            <div style={styles.statValue}>{voltages.size}</div>
            <div style={styles.statLabel}>neurons</div>
          </div>
        </div>
      </div>

      <div style={styles.visualizer}>
        {voltages.size === 0 ? (
          <div style={styles.emptyState}>
            {!connected && <p>Waiting for connection...</p>}
            {connected && !running && <p>Click START to begin simulation</p>}
            {connected && running && <p>Waiting for data...</p>}
          </div>
        ) : (
          <div style={styles.neuronsGrid}>
            {Array.from(voltages.entries()).map(([id, voltage]) => {
              const isSpiking = spikes.includes(id);
              const color = getVoltageColor(voltage);
              const height = voltageToPercent(voltage);
              
              return (
                <div key={id} style={styles.neuronCard}>
                  <div style={styles.neuronHeader}>
                    <span style={styles.neuronId}>{id}</span>
                    {isSpiking && (
                      <span style={styles.spikeIndicator}>⚡</span>
                    )}
                  </div>
                  
                  <div style={styles.voltageBar}>
                    <div 
                      style={{
                        ...styles.voltageBarFill,
                        height: `${height}%`,
                        backgroundColor: color,
                        boxShadow: isSpiking ? `0 0 10px ${color}` : 'none'
                      }}
                    />
                  </div>
                  
                  <div style={styles.voltageValue}>
                    {voltage.toFixed(1)} mV
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {metadata && (
        <div style={styles.metadata}>
          <h3>Model Info</h3>
          <ul>
            <li>Timestep: {metadata.dt} ms</li>
            <li>Voltage Update: Every {metadata.voltage_interval_ms} ms</li>
            <li>Neurons: {metadata.neurons.length}</li>
          </ul>
        </div>
      )}
    </div>
  );
}

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '20px',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    minHeight: '100vh',
    fontFamily: 'monospace',
  },
  header: {
    marginBottom: '30px',
  },
  controls: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px',
  },
  button: {
    padding: '10px 20px',
    fontSize: '16px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontFamily: 'monospace',
  },
  startButton: {
    backgroundColor: '#44ff44',
    color: '#000',
  },
  stopButton: {
    backgroundColor: '#ff4444',
    color: '#fff',
  },
  status: {
    display: 'flex',
    gap: '30px',
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#2a2a2a',
    borderRadius: '5px',
  },
  statusItem: {
    display: 'flex',
    gap: '10px',
  },
  statusLabel: {
    color: '#888',
  },
  statusValue: {
    fontWeight: 'bold',
  },
  stats: {
    display: 'flex',
    gap: '20px',
    marginTop: '20px',
  },
  statBox: {
    padding: '15px',
    backgroundColor: '#2a2a2a',
    borderRadius: '5px',
    textAlign: 'center' as const,
    minWidth: '100px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#44ff44',
  },
  statLabel: {
    fontSize: '12px',
    color: '#888',
    marginTop: '5px',
  },
  visualizer: {
    minHeight: '400px',
    backgroundColor: '#0a0a0a',
    borderRadius: '10px',
    padding: '20px',
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
    color: '#666',
    fontSize: '18px',
  },
  neuronsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '20px',
  },
  neuronCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    padding: '15px',
    border: '1px solid #333',
  },
  neuronHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  neuronId: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#aaa',
  },
  spikeIndicator: {
    fontSize: '20px',
    animation: 'pulse 0.3s ease-in-out',
  },
  voltageBar: {
    height: '100px',
    backgroundColor: '#0a0a0a',
    borderRadius: '4px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'flex-end',
    marginBottom: '10px',
  },
  voltageBarFill: {
    width: '100%',
    transition: 'height 0.1s ease-out, background-color 0.1s ease-out',
  },
  voltageValue: {
    textAlign: 'center' as const,
    fontSize: '12px',
    color: '#888',
  },
  metadata: {
    marginTop: '30px',
    padding: '20px',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
  },
};

export default GeNNStreamDemo;
