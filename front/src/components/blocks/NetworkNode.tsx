
import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Box } from 'lucide-react';

export type NetworkNodeData = Record<string, unknown> & {
    label: string;
    networkName: string;
    // Potentially input/output definitions could go here
};

const NetworkNode = ({ data }: NodeProps) => {
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
            gap: '8px'
        }}>
            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500" />

            <div className="flex items-center gap-2 border-b border-slate-700 pb-2 mb-1 w-full justify-center">
                <Box size={16} className="text-blue-400" />
                <span className="font-bold text-sm">{nodeData.label}</span>
            </div>

            <div className="text-xs text-slate-400">
                {nodeData.networkName}
            </div>

            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-500" />
        </div>
    );
};

export default memo(NetworkNode);

