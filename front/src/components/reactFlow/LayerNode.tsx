import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react';
import {
  NEURON_SPACING,
  LAYER_PADDING,
  LAYER_WIDTH,
  getChildPosition,
  isChildVisible,
} from '../../config/graphLayoutConfig';
import { expandLayerPlaceholder } from '../../config/layerFactory';
import { Input } from '../ui/input';

export type LayerNodeData = {
  neuronCount: number;
  neuronType: string;
  parameters: Record<string, unknown>;
  collapsed?: boolean;
  pending?: boolean;
};

const COLLAPSE_THRESHOLD = 5;
const DEFAULT_PENDING_HEIGHT = 2 * LAYER_PADDING + NEURON_SPACING;
const MIN_NEURONS = 1;
const MAX_NEURONS = 1024;
const EDITING_LAYER_Z_INDEX = 12000;

const readNumericHeight = (height: unknown, fallback: number): number => {
  if (typeof height === 'number') return height;
  if (typeof height === 'string') {
    const parsed = parseFloat(height);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const clampNeuronCount = (count: number): number => Math.max(MIN_NEURONS, Math.min(MAX_NEURONS, count));
const parseNeuronCount = (raw: string): number => clampNeuronCount(parseInt(raw, 10) || 5);
const computeLayerHeight = (count: number, collapsed: boolean): number =>
  collapsed
    ? 5 * NEURON_SPACING + 2 * LAYER_PADDING
    : count * NEURON_SPACING + 2 * LAYER_PADDING;

const LayerNode: React.FC<NodeProps> = ({ id, data }) => {
  const nodeData = data as LayerNodeData;
  const { setNodes, getNodes, setEdges } = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);
  const [pendingCount, setPendingCount] = useState('5');
  const [isEditingCount, setIsEditingCount] = useState(false);
  const [editCount, setEditCount] = useState('5');

  const n = nodeData.neuronCount ?? 0;
  const pending = nodeData.pending ?? false;
  const collapsed = nodeData.collapsed ?? (n > COLLAPSE_THRESHOLD);
  const canCollapse = n > COLLAPSE_THRESHOLD;

  const applyNeuronCountChange = useCallback((nextCount: number) => {
    const count = clampNeuronCount(nextCount);
    const nodes = getNodes();
    const layerNode = nodes.find((nd) => nd.id === id);
    if (!layerNode || layerNode.type !== 'layer') return;

    const layerData = layerNode.data as LayerNodeData;
    const previousCount = layerData.neuronCount ?? 0;
    const previousCollapsed = layerData.collapsed ?? (previousCount > COLLAPSE_THRESHOLD);
    const newCollapsed = count > COLLAPSE_THRESHOLD
      ? (typeof layerData.collapsed === 'boolean' ? layerData.collapsed : true)
      : false;
    const childNodes = expandLayerPlaceholder(
      id,
      count,
      layerData.neuronType ?? 'LIF',
      layerData.parameters ?? {},
      newCollapsed
    );

    const newHeight = computeLayerHeight(count, newCollapsed);
    const currentHeight = readNumericHeight(
      layerNode.style?.height,
      computeLayerHeight(Math.max(previousCount, 1), previousCollapsed)
    );
    const yOffset = (newHeight - currentHeight) / 2;

    setNodes((nds) => [
      ...nds.filter((nd) => nd.id !== id && nd.parentId !== id),
      {
        ...layerNode,
        data: {
          ...layerData,
          neuronCount: count,
          pending: false,
          collapsed: newCollapsed,
        },
        position: { ...layerNode.position, y: layerNode.position.y - yOffset },
        style: { ...layerNode.style, width: LAYER_WIDTH, height: newHeight },
      },
      ...childNodes,
    ]);

    setEdges((eds) =>
      eds.filter((edge) => {
        const getChildIndex = (nodeId: string): number | null => {
          if (!nodeId.startsWith(`${id}-`)) return null;
          const parsed = parseInt(nodeId.slice(id.length + 1), 10);
          return Number.isInteger(parsed) ? parsed : null;
        };
        const sourceIdx = getChildIndex(edge.source);
        const targetIdx = getChildIndex(edge.target);
        return (sourceIdx === null || sourceIdx < count) && (targetIdx === null || targetIdx < count);
      })
    );
  }, [getNodes, id, setEdges, setNodes]);

  const setLayerEditingUiState = useCallback((editing: boolean) => {
    setNodes((nds) => {
      const layerNode = nds.find((nd) => nd.id === id && nd.type === 'layer');
      const layerData = (layerNode?.data as LayerNodeData | undefined) ?? undefined;
      const neuronCount = layerData?.neuronCount ?? n;
      const collapsedState = layerData?.collapsed ?? (neuronCount > COLLAPSE_THRESHOLD);

      return nds.map((nd) => {
        if (nd.id === id) {
          return { ...nd, zIndex: editing ? EDITING_LAYER_Z_INDEX : 100 };
        }

        if (nd.parentId === id) {
          if (editing) {
            return { ...nd, hidden: true, zIndex: 0 };
          }

          const idx = parseInt(nd.id.split('-').pop() ?? '0', 10);
          const shouldBeVisible = isChildVisible(neuronCount, collapsedState, idx);
          return { ...nd, hidden: !shouldBeVisible, zIndex: 0 };
        }

        return nd;
      });
    });
  }, [id, n, setNodes]);

  const confirmNeuronCount = useCallback(() => {
    applyNeuronCountChange(parseNeuronCount(pendingCount));
  }, [applyNeuronCountChange, pendingCount]);

  const startEditingNeuronCount = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const current = clampNeuronCount(n || 1);
    setEditCount(String(current));
    setIsEditingCount(true);
    setLayerEditingUiState(true);
  }, [n, setLayerEditingUiState]);

  const applyEditedNeuronCount = useCallback((e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    applyNeuronCountChange(parseNeuronCount(editCount));
    setIsEditingCount(false);
    setLayerEditingUiState(false);
  }, [applyNeuronCountChange, editCount, setLayerEditingUiState]);

  const cancelEditingNeuronCount = useCallback((e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    setIsEditingCount(false);
    setLayerEditingUiState(false);
  }, [setLayerEditingUiState]);

  const toggleCollapsed = useCallback(() => {
    if (!canCollapse) return; 

    const nodes = getNodes();
    const layerNode = nodes.find((nd) => nd.id === id);
    if (!layerNode || layerNode.type !== 'layer') return;

    const newCollapsed = !(layerNode.data as LayerNodeData).collapsed;
    const neuronCount = (layerNode.data as LayerNodeData).neuronCount ?? 0;

    setNodes((nds) =>
      nds.map((nd) => {
        if (nd.id === id && nd.type === 'layer') {
          const oldHeight = readNumericHeight(nd.style?.height, DEFAULT_PENDING_HEIGHT);
          const newHeight = newCollapsed
            ? 5 * NEURON_SPACING + 2 * LAYER_PADDING
            : neuronCount * NEURON_SPACING + 2 * LAYER_PADDING;
          const yOffset = (newHeight - oldHeight) / 2;
          return {
            ...nd,
            data: { ...nd.data, collapsed: newCollapsed },
            position: { ...nd.position, y: nd.position.y - yOffset },
            style: { ...nd.style, width: LAYER_WIDTH, height: newHeight },
          };
        }
        if (nd.parentId === id) {
          const idx = parseInt(nd.id.split('-').pop() ?? '0', 10);
          return {
            ...nd,
            position: getChildPosition(neuronCount, newCollapsed, idx),
            hidden: !isChildVisible(neuronCount, newCollapsed, idx),
          };
        }
        return nd;
      })
    );
  }, [canCollapse, getNodes, id, setNodes]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (pending) return;
      toggleCollapsed();
    },
    [toggleCollapsed, pending]
  );

  return (
    <div
      className={`relative w-full h-full transition-colors duration-300 ${canCollapse && !pending ? 'cursor-pointer' : ''} ${isEditingCount ? 'z-[10000]' : ''}`}
      style={{ minHeight: 56, minWidth: LAYER_WIDTH, zIndex: isEditingCount ? 10000 : undefined }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={handleDoubleClick}
      title={canCollapse && !pending ? 'Double-click to expand/collapse' : undefined}
    >
      {/* Border - visible always, glow on hover */}
      <div
        className={`absolute inset-0 rounded-lg border-2 transition-all duration-300 ${
          pending
            ? 'border-dashed border-cyan-500/60 bg-cyan-500/5'
            : isHovered
              ? 'border-cyan-500/70 shadow-[0_0_16px_rgba(56,189,248,0.3)]'
              : 'border-slate-600/60 bg-slate-800/30'
        }`}
        style={{ pointerEvents: 'none' }}
      />

      {/* Pending: input + tick */}
      {pending && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 px-2">
          <Input
            type="number"
            min={1}
            max={64}
            value={pendingCount}
            onChange={(e) => setPendingCount(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="nodrag nopan h-8 w-14 rounded-md border-slate-600 bg-slate-800/90 px-2 text-center text-sm text-slate-100 focus-visible:border-cyan-500/70 focus-visible:ring-cyan-500/30"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              confirmNeuronCount();
            }}
            className="p-1.5 rounded-md bg-cyan-500/80 hover:bg-cyan-400 text-slate-900 transition-colors nodrag nopan"
            title="Confirm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Quick edit: hover action for neuron count */}
      {!pending && isHovered && !isEditingCount && (
        <button
          type="button"
          onClick={startEditingNeuronCount}
          onDoubleClick={(e) => e.stopPropagation()}
          className="absolute top-1.5 right-1.5 z-30 p-1 rounded-md border border-slate-500/70 bg-slate-900/75 text-slate-200 hover:bg-slate-800 hover:border-cyan-400/80 transition-colors nodrag nopan"
          title="Edit neuron count"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      )}

      {!pending && isEditingCount && (
        <div
          className="absolute top-1.5 right-1.5 z-[10000] flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-slate-950/95 px-2 py-1.5 shadow-[0_12px_35px_rgba(8,47,73,0.55)] backdrop-blur-md nodrag nopan pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditCount((prev) => String(clampNeuronCount((parseInt(prev, 10) || 1) - 1)));
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-7 w-7 rounded-lg border border-slate-600/80 bg-slate-800/85 text-slate-200 transition-all hover:border-cyan-400/60 hover:bg-slate-700/90 hover:text-cyan-200"
            title="Decrease neurons"
          >
            -
          </button>
          <Input
            type="number"
            min={MIN_NEURONS}
            max={MAX_NEURONS}
            value={editCount}
            autoFocus
            onChange={(e) => setEditCount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyEditedNeuronCount(e);
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelEditingNeuronCount(e);
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="nodrag nopan h-7 w-16 rounded-lg border-slate-500/80 bg-slate-900/90 px-2 text-center text-xs font-semibold text-slate-100 focus-visible:border-cyan-400/70 focus-visible:ring-cyan-500/30"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditCount((prev) => String(clampNeuronCount((parseInt(prev, 10) || 1) + 1)));
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-7 w-7 rounded-lg border border-slate-600/80 bg-slate-800/85 text-slate-200 transition-all hover:border-cyan-400/60 hover:bg-slate-700/90 hover:text-cyan-200"
            title="Increase neurons"
          >
            +
          </button>
          <button
            type="button"
            onClick={applyEditedNeuronCount}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 px-2 text-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.35)] transition-all hover:from-cyan-300 hover:to-blue-400"
            title="Apply"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          <button
            type="button"
            onClick={cancelEditingNeuronCount}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-7 rounded-lg border border-slate-600/80 bg-slate-800/85 px-2 text-slate-200 transition-all hover:border-slate-400/80 hover:bg-slate-700/90"
            title="Cancel"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Ellipsis placeholder when collapsed */}
      {!pending && collapsed && canCollapse && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center text-slate-500 text-sm font-medium"
          style={{
            top: LAYER_PADDING + 2 * NEURON_SPACING,
            width: 40,
            height: NEURON_SPACING,
          }}
        >
          ⋮⋮⋮
        </div>
      )}

      {/* Layer handles - min size to avoid width 0 */}
      <Handle
        id="layer-in"
        type="target"
        position={Position.Left}
        style={{ minWidth: 14, minHeight: 14, left: '-7px', top: '50%', transform: 'translate(-50%, -50%)' }}
        className="!w-[14px] !h-[14px] !min-w-[14px] !min-h-[14px] !bg-sky-400/90 !border-[1.5px] !border-sky-100/70 !shadow-[0_0_0_2px_rgba(56,189,248,0.18)] !z-20 transition-all duration-200 hover:!bg-sky-300 nodrag nopan"
      />
      <Handle
        id="layer-out"
        type="source"
        position={Position.Right}
        style={{ minWidth: 14, minHeight: 14, right: '-7px', top: '50%', transform: 'translate(50%, -50%)' }}
        className="!w-[14px] !h-[14px] !min-w-[14px] !min-h-[14px] !bg-amber-400/90 !border-[1.5px] !border-amber-100/70 !shadow-[0_0_0_2px_rgba(251,191,36,0.18)] !z-20 transition-all duration-200 hover:!bg-amber-300 nodrag nopan"
      />
    </div>
  );
};

export default memo(LayerNode);
