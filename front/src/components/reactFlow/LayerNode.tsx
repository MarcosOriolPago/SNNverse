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

export type LayerNodeData = {
  neuronCount: number;
  neuronType: string;
  parameters: Record<string, unknown>;
  collapsed?: boolean;
  pending?: boolean;
};

const COLLAPSE_THRESHOLD = 5;
const DEFAULT_PENDING_HEIGHT = 2 * LAYER_PADDING + NEURON_SPACING;

const readNumericHeight = (height: unknown, fallback: number): number => {
  if (typeof height === 'number') return height;
  if (typeof height === 'string') {
    const parsed = parseFloat(height);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const LayerNode: React.FC<NodeProps> = ({ id, data }) => {
  const nodeData = data as LayerNodeData;
  const { setNodes, getNodes } = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);
  const [pendingCount, setPendingCount] = useState('5');

  const n = nodeData.neuronCount ?? 0;
  const pending = nodeData.pending ?? false;
  const collapsed = nodeData.collapsed ?? (n > COLLAPSE_THRESHOLD);
  const canCollapse = n > COLLAPSE_THRESHOLD;

  const height = pending
    ? DEFAULT_PENDING_HEIGHT
    : collapsed
      ? 5 * NEURON_SPACING + 2 * LAYER_PADDING
      : n * NEURON_SPACING + 2 * LAYER_PADDING;

  const confirmNeuronCount = useCallback(() => {
    const count = Math.max(1, Math.min(64, parseInt(pendingCount, 10) || 5));
    const nodes = getNodes();
    const layerNode = nodes.find((nd) => nd.id === id);
    if (!layerNode || layerNode.type !== 'layer') return;

    const layerData = layerNode.data as LayerNodeData;
    const childNodes = expandLayerPlaceholder(
      id,
      count,
      layerData.neuronType ?? 'LIF',
      layerData.parameters ?? {}
    );

    const newHeight = count > COLLAPSE_THRESHOLD
      ? 5 * NEURON_SPACING + 2 * LAYER_PADDING
      : count * NEURON_SPACING + 2 * LAYER_PADDING;
    const currentHeight = readNumericHeight(layerNode.style?.height, DEFAULT_PENDING_HEIGHT);
    const yOffset = (newHeight - currentHeight) / 2;

    setNodes((nds) => [
      ...nds.filter((nd) => nd.id !== id),
      {
        ...layerNode,
        data: {
          ...layerData,
          neuronCount: count,
          pending: false,
          collapsed: count > COLLAPSE_THRESHOLD,
        },
        position: { ...layerNode.position, y: layerNode.position.y - yOffset },
        style: { ...layerNode.style, width: LAYER_WIDTH, height: newHeight },
      },
      ...childNodes,
    ]);
  }, [id, getNodes, setNodes, pendingCount]);

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
      className={`relative w-full h-full transition-colors duration-300 ${canCollapse && !pending ? 'cursor-pointer' : ''}`}
      style={{ minHeight: 56, minWidth: LAYER_WIDTH }}
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
          <input
            type="number"
            min={1}
            max={64}
            value={pendingCount}
            onChange={(e) => setPendingCount(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="w-14 h-8 px-2 text-center text-sm bg-slate-800/90 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 nodrag nopan"
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
        style={{ minWidth: 14, minHeight: 14 }}
        className="!w-[14px] !h-[14px] !min-w-[14px] !min-h-[14px] !bg-sky-400/90 !border-[1.5px] !border-sky-100/70 !shadow-[0_0_0_2px_rgba(56,189,248,0.18)] !z-20 !top-1/2 !-translate-y-1/2 !left-[-7px] transition-all duration-200 hover:!bg-sky-300 nodrag nopan"
      />
      <Handle
        id="layer-out"
        type="source"
        position={Position.Right}
        style={{ minWidth: 14, minHeight: 14 }}
        className="!w-[14px] !h-[14px] !min-w-[14px] !min-h-[14px] !bg-amber-400/90 !border-[1.5px] !border-amber-100/70 !shadow-[0_0_0_2px_rgba(251,191,36,0.18)] !z-20 !top-1/2 !-translate-y-1/2 !right-[-7px] transition-all duration-200 hover:!bg-amber-300 nodrag nopan"
      />
    </div>
  );
};

export default memo(LayerNode);
