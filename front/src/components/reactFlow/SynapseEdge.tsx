import React, { useEffect, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  useReactFlow,
} from '@xyflow/react';
import {
  SYNAPSE_CONNECTION_TYPES,
  type SynapseConnectionType,
} from '../../config/synapseConfig';
import { eventBus } from '../../lib/EventBus';

type SynapseEdgeData = {
  connectionType?: SynapseConnectionType | null;
  weight?: number;
  showExpanded?: boolean;
  proxyFor?: string;
  hideLabel?: boolean;
  proxyActive?: boolean;
};

const SynapseEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) => {
  const { setEdges } = useReactFlow();
  const [spikeRate, setSpikeRate] = useState<number>(0);
  const edgeData = (data ?? {}) as SynapseEdgeData;
  const isProxy = !!edgeData.proxyFor;
  const connectionType = edgeData.connectionType ?? null;
  const isPending = connectionType === null || connectionType === undefined;
  const proxyActive = edgeData.proxyActive ?? false;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Subscribe to spike rate for this edge (when source is a population)
  useEffect(() => {
    const unsubscribe = eventBus.subscribe((update: { edgeId?: string; spikeRate?: number }) => {
      if (update.edgeId === id && update.spikeRate !== undefined) {
        setSpikeRate(update.spikeRate);
      }
    });
    return () => unsubscribe();
  }, [id]);

  const setConnectionType = (type: SynapseConnectionType) => {
    setEdges((edges) =>
      edges.map((e) => {
        if (e.id === id) {
          return { ...e, data: { ...e.data, connectionType: type } };
        }
        return e;
      })
    );
  };

  const isIdle = spikeRate <= 0;
  const strokeColor = spikeRate > 0 ? 'rgb(100, 220, 80)' : 'rgb(140, 140, 136)';
  const strokeWidth = spikeRate > 0 ? 2 : 1.25;
  const shouldRenderMainPath = !proxyActive;

  return (
    <>
      {shouldRenderMainPath && (
        <BaseEdge
          path={edgePath}
          markerEnd={markerEnd}
          style={{
            ...style,
            stroke: strokeColor,
            strokeWidth,
            strokeOpacity: 1,
            strokeLinecap: 'round',
            strokeDasharray: isIdle ? '5, 5' : 'none',
            animation: isPending ? 'dashdraw 0.5s linear infinite' : undefined,
          }}
        />
      )}

      {!isProxy && !edgeData.hideLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 12,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div className="flex flex-col items-center gap-1">
              {isPending ? (
                <div className="flex flex-wrap gap-1 justify-center max-w-[200px]">
                  {SYNAPSE_CONNECTION_TYPES.map(({ id: tid, label }) => (
                    <button
                      key={tid}
                      className="px-2 py-1 rounded border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:border-cyan-500 text-xs font-medium transition-colors"
                      onClick={() => setConnectionType(tid)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded border border-cyan-500/60 bg-slate-800/90 text-cyan-300 text-xs font-mono">
                    {connectionType}
                  </span>
                  {proxyActive && (
                    <span className="px-2 py-1 rounded border border-slate-600 bg-slate-800/85 text-slate-300 text-[10px] font-semibold uppercase tracking-wide">
                      neuron-level
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
      <style>{`
        @keyframes dashdraw {
          from { stroke-dashoffset: 10; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </>
  );
};

export default SynapseEdge;
