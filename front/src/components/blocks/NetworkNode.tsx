
import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Box } from 'lucide-react';
import '../../styles/nodes.css';

export type NetworkNodeData = Record<string, unknown> & {
    label: string;
    networkName: string;
    // Potentially input/output definitions could go here
};

const NetworkNode = ({ data, isConnectable }: NodeProps) => {
    const nodeData = data as NetworkNodeData;
    return (
        <div className="network-node-block" style={{
            padding: '10px 20px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid #334155',
            color: '#f8fafc',
            minWidth: '150px',
            textAlign: 'center',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            position: 'relative'
        }}>
            <Handle
                type="source"
                position={Position.Right}
                isConnectable={isConnectable}
                style={{
                    width: '12px',
                    height: '12px',
                    background: '#22c55e',
                    right: -6, // Position slightly outside
                    border: '2px solid #1e293b'
                }}
            />

            <div className="network-node-header">
                <Box size={16} className="icon" />
            </div>

            <div className="network-node-info">
                {nodeData.networkName}
            </div>

            <Handle
                type="target"
                position={Position.Left}
                isConnectable={isConnectable}
                style={{
                    width: '12px',
                    height: '12px',
                    background: '#3b82f6',
                    left: -6, // Position slightly outside
                    border: '2px solid #1e293b' // Add border for contrast
                }}
            />
        </div>
    );
};

export default memo(NetworkNode);

