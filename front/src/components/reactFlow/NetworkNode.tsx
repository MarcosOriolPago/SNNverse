
import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Box } from 'lucide-react';

export type NetworkNodeData = Record<string, unknown> & {
    label: string;
    networkName: string;
    // Potentially input/output definitions could go here
};

const NetworkNode = ({ data, isConnectable }: NodeProps) => {
    const nodeData = data as NetworkNodeData;
    return (
        <div
            className="flex flex-col items-center gap-2 relative px-5 py-[10px] rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 text-slate-50 min-w-[150px] text-center shadow-sm"
        >
            <Handle
                type="source"
                position={Position.Right}
                isConnectable={isConnectable}
                className="!w-[12px] !h-[12px] !bg-[#22c55e] !-right-[6px] !border-2 !border-[#1e293b]"
            />

            <div className="flex items-center justify-center">
                <Box size={16} className="w-4 h-4 text-blue-400" />
            </div>

            <div className="text-xs text-slate-400">
                {nodeData.networkName}
            </div>

            <Handle
                type="target"
                position={Position.Left}
                isConnectable={isConnectable}
                className="!w-[12px] !h-[12px] !bg-[#3b82f6] !-left-[6px] !border-2 !border-[#1e293b]"
            />
        </div>
    );
};

export default memo(NetworkNode);
