import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Keyboard } from 'lucide-react';

export type KeyboardNodeData = {
    label?: string;
};

const KeyboardNodeComponent: React.FC<NodeProps> = ({ isConnectable, selected }) => {

    const borderClass = selected
        ? 'border-purple-500 shadow-[0_0_0_2px_rgba(168,85,247,0.4),var(--shadow-card)]'
        : 'border-purple-500/30 hover:border-purple-400/50';

    return (
        <div className={`relative group min-w-[160px] bg-slate-900/90 backdrop-blur-md rounded-lg shadow-xl border transition-all duration-300 ${borderClass}`}>

            <div className="flex items-center gap-3 p-3">
                <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-lg border border-purple-500/20 shadow-inner">
                    <Keyboard className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-200 tracking-wide leading-none mb-1">KEYBOARD</span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Input Device</span>
                </div>
            </div>

            <Handle
                type="source"
                position={Position.Right}
                isConnectable={isConnectable}
                className="!w-3 !h-3 !bg-purple-500 !border-2 !border-slate-900 shadow-[0_0_10px_rgba(168,85,247,0.4)] hover:scale-125 transition-transform -mr-1.5"
            />
        </div>
    );
};

export default memo(KeyboardNodeComponent);
