import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Activity } from 'lucide-react';

export type MonitorNodeData = Record<string, unknown> & {
    label?: string;
};

const MonitorNode = ({ data, isConnectable }: NodeProps) => {
    const { label = 'Signal Monitor' } = data as MonitorNodeData;

    return (
        <div className="min-w-[180px] bg-slate-900 border-2 border-slate-700 rounded-xl shadow-md flex flex-col overflow-hidden transition-normal hover:border-cyan-light hover:shadow-[0_8px_12px_-1px_rgba(56,189,248,0.2)]">
            {/* Header */}
            <div className="flex items-center gap-sm px-md py-sm bg-slate-800 border-b border-slate-700">
                <Activity size={14} className="text-cyan w-4 h-4" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-widest">{label}</span>
            </div>

            {/* Screen Area */}
            <div className="relative h-[6rem] w-full bg-black flex items-center justify-center overflow-hidden">
                {/* Grid Lines */}
                <div className="absolute inset-0 opacity-50 pointer-events-none bg-[linear-gradient(#1e293b_1px,transparent_1px),linear-gradient(90deg,#1e293b_1px,transparent_1px)] bg-[size:20px_20px]" />

                {/* Simulated Signal Line (Static for now, could be animated SVG) */}
                <svg className="absolute inset-0 w-full h-full p-2 drop-shadow-[0_0_4px_var(--color-green)]" preserveAspectRatio="none">
                    <path
                        d="M0,50 Q20,50 30,20 T50,50 T70,80 T90,50 T120,50 T140,30 T160,50 T180,50"
                        stroke="var(--color-green)" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke"
                    />
                </svg>

                <div className="absolute top-1 right-2 text-[10px] text-green font-mono animate-[blink_2s_infinite]">
                    LIVE
                </div>
            </div>

            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Left}
                isConnectable={isConnectable}
                className="!w-[0.75rem] !h-[0.75rem] !bg-[#06b6d4] !border-2 !border-slate-900 !left-[-6px]"
            />
            <style>{`
                @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            `}</style>
        </div>
    );
};

export default memo(MonitorNode);
