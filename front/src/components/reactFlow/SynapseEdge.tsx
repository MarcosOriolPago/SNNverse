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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

type SynapseEdgeData = {
  connectionType?: SynapseConnectionType | null;
  weight?: number;
  showExpanded?: boolean;
  proxyFor?: string;
  hideLabel?: boolean;
  proxyActive?: boolean;
};

const DEFAULT_CONNECTION_TYPE: SynapseConnectionType = 'dense';

const normalizeConnectionType = (value: unknown): SynapseConnectionType => {
  if (
    typeof value === 'string' &&
    SYNAPSE_CONNECTION_TYPES.some(({ id }) => id === value)
  ) {
    return value as SynapseConnectionType;
  }
  return DEFAULT_CONNECTION_TYPE;
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
  const [isHovered, setIsHovered] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const edgeData = (data ?? {}) as SynapseEdgeData;
  const isProxy = !!edgeData.proxyFor;
  const connectionType = normalizeConnectionType(edgeData.connectionType);
  const proxyActive = edgeData.proxyActive ?? false;
  const showEditControl = isHovered || isEditorOpen;

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
    if (type === connectionType) return;
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
            <div
              className="relative flex h-8 w-8 items-center justify-center"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <DropdownMenu open={isEditorOpen} onOpenChange={setIsEditorOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`z-10 rounded-md border border-slate-500/70 bg-slate-900/80 p-1 text-slate-200 shadow-sm transition-all hover:border-cyan-400/80 hover:bg-slate-800 ${
                      showEditControl ? 'opacity-100' : 'pointer-events-none opacity-0'
                    }`}
                    title={proxyActive ? 'Edit synapse (neuron-level active)' : 'Edit synapse connection'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" sideOffset={8} className="w-56">
                  <DropdownMenuLabel>Connection type</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={connectionType}
                    onValueChange={(value) => setConnectionType(normalizeConnectionType(value))}
                  >
                    {SYNAPSE_CONNECTION_TYPES.map(({ id: tid, label, description }) => (
                      <DropdownMenuRadioItem key={tid} value={tid}>
                        <div className="flex flex-col">
                          <span>{label}</span>
                          <span className="text-[11px] text-slate-500">{description}</span>
                        </div>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default SynapseEdge;
