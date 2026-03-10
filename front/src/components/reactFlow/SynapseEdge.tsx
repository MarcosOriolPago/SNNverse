import React, { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  useReactFlow,
} from '@xyflow/react';
import { SYNAPSE_CONNECTION_TYPES, type SynapseConnectionType } from '../../config/nodeGraphConfig';
import { eventBus } from '../../lib/EventBus';

type SynapseEdgeData = {
  connectionType?: SynapseConnectionType | null;
  weight?: number;
  showExpanded?: boolean;
};

const SynapseEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  source,
  target,
  style = {},
  markerEnd,
  data,
}) => {
  const { setEdges, getNodes } = useReactFlow();
  const [spikeRate, setSpikeRate] = useState<number>(0);
  const edgeData = (data ?? {}) as SynapseEdgeData;
  const connectionType = edgeData.connectionType ?? null;
  const isPending = connectionType === null || connectionType === undefined;
  const showExpanded = edgeData.showExpanded ?? false;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Subscribe to spike rate for this edge (when source is a population)
  React.useEffect(() => {
    const unsubscribe = eventBus.subscribe((update: { edgeId?: string; spikeRate?: number }) => {
      if (update.edgeId === id && update.spikeRate !== undefined) {
        setSpikeRate(update.spikeRate);
      }
    });
    return () => unsubscribe();
  }, [id]);

  const getBundlePaths = (count: number) => {
    const paths: string[] = [];
    const spread = 8;
    const offset = (i: number) => ((i - (count - 1) / 2) * spread);
    for (let i = 0; i < count; i++) {
      const dx = offset(i);
      const dy = offset(i) * 0.5;
      const [p] = getBezierPath({
        sourceX: sourceX + dx,
        sourceY: sourceY + dy,
        sourcePosition,
        targetX: targetX + dx,
        targetY: targetY + dy,
        targetPosition,
      });
      paths.push(p);
    }
    return paths;
  };

  const nodes = getNodes();
  const sourceNode = nodes.find((n) => n.id === source);
  const targetNode = nodes.find((n) => n.id === target);
  const sourceSize = (sourceNode?.type === 'layer'
    ? (sourceNode.data as { neuronCount?: number }).neuronCount
    : 1) ?? 1;
  const targetSize = (targetNode?.type === 'layer'
    ? (targetNode.data as { neuronCount?: number }).neuronCount
    : 1) ?? 1;
  const bundleCount = showExpanded && connectionType ? Math.min(Math.max(sourceSize, targetSize), 12) : 1;

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

  const toggleExpanded = () => {
    setEdges((edges) =>
      edges.map((e) => {
        if (e.id === id) {
          return { ...e, data: { ...e.data, showExpanded: !(e.data?.showExpanded ?? false) } };
        }
        return e;
      })
    );
  };

  const getStrokeColor = () => {
    if (isPending) return '#64748b';
    if (spikeRate > 0) {
      return 'rgb(100, 220, 80)';
    }
    return '#a855f7';
  };

  const getStrokeWidth = () => (isPending ? 1.5 : 2);

  return (
    <>
      {/* Main edge(s) */}
      {bundleCount > 1 ? (
        <g>
          {getBundlePaths(bundleCount).map((path, i) => (
            <BaseEdge
              key={i}
              path={path}
              markerEnd={i === 0 ? markerEnd : undefined}
              style={{
                ...style,
                stroke: getStrokeColor(),
                strokeWidth: getStrokeWidth() * (1 - i * 0.03),
                strokeOpacity: 1 - i * 0.06,
                strokeDasharray: isPending ? '5, 5' : 'none',
                animation: isPending ? 'dashdraw 0.5s linear infinite' : undefined,
              }}
            />
          ))}
        </g>
      ) : (
        <BaseEdge
          path={edgePath}
          markerEnd={markerEnd}
          style={{
            ...style,
            stroke: getStrokeColor(),
            strokeWidth: getStrokeWidth(),
            strokeDasharray: isPending ? '5, 5' : 'none',
            animation: isPending ? 'dashdraw 0.5s linear infinite' : undefined,
          }}
        />
      )}

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
                {bundleCount > 1 ? (
                  <button
                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 border border-slate-600 text-slate-400 hover:text-slate-200"
                    onClick={toggleExpanded}
                  >
                    Collapse
                  </button>
                ) : (
                  <button
                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 border border-slate-600 text-slate-400 hover:text-slate-200"
                    onClick={toggleExpanded}
                    title="Show all connections"
                  >
                    Expand
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
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
