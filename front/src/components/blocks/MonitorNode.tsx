import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Activity } from 'lucide-react';
import '../../styles/nodes.css';

export type MonitorNodeData = Record<string, unknown> & {
    label?: string;
};

const MonitorNode = ({ data, isConnectable }: NodeProps) => {
    const { label = 'Signal Monitor' } = data as MonitorNodeData;

    return (
        <div className="monitor-node">
            {/* Header */}
            <div className="monitor-header">
                <Activity size={14} className="monitor-icon" />
                <span className="monitor-label">{label}</span>
            </div>

            {/* Screen Area */}
            <div className="monitor-screen">
                {/* Grid Lines */}
                <div className="monitor-grid" />

                {/* Simulated Signal Line (Static for now, could be animated SVG) */}
                <svg className="monitor-signal" preserveAspectRatio="none">
                    <path
                        d="M0,50 Q20,50 30,20 T50,50 T70,80 T90,50 T120,50 T140,30 T160,50 T180,50"
                    />
                </svg>

                <div className="monitor-live">
                    LIVE
                </div>
            </div>

            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Left}
                isConnectable={isConnectable}
                className="monitor-handle"
                style={{ left: -6 }}
            />
        </div>
    );
};

export default memo(MonitorNode);
