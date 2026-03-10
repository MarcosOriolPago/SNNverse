import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react';
import { NEURON_SPACING, LAYER_PADDING } from '../../config/nodeGraphConfig';

export type LayerNodeData = {
  neuronCount: number;
  neuronType: string;
  parameters: Record<string, unknown>;
  collapsed?: boolean;
};

const COLLAPSE_THRESHOLD = 5;

const LayerNode: React.FC<NodeProps> = ({ id, data }) => {
  const nodeData = data as LayerNodeData;
  const { setNodes, getNodes } = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);

  const n = nodeData.neuronCount ?? 1;
  const collapsed = nodeData.collapsed ?? (n > COLLAPSE_THRESHOLD);
  const canCollapse = n > COLLAPSE_THRESHOLD;

  const height = collapsed
    ? 5 * NEURON_SPACING + 2 * LAYER_PADDING
    : n * NEURON_SPACING + 2 * LAYER_PADDING;
  const width = 140;

  const toggleCollapsed = useCallback(() => {
    if (!canCollapse) return;

    const nodes = getNodes();
    const layerNode = nodes.find((nd) => nd.id === id);
    if (!layerNode || layerNode.type !== 'layer') return;

    const newCollapsed = !(layerNode.data as LayerNodeData).collapsed;
    const neuronCount = (layerNode.data as LayerNodeData).neuronCount ?? 0;
    const parentWidth = 140;
    const neuronWidth = 60;
    const xCenter = (parentWidth - neuronWidth) / 2;

    const getChildPosition = (i: number) => {
      if (!newCollapsed) return { x: xCenter, y: LAYER_PADDING + i * NEURON_SPACING };
      if (i <= 1) return { x: xCenter, y: LAYER_PADDING + i * NEURON_SPACING };
      if (i >= neuronCount - 2) return { x: xCenter, y: LAYER_PADDING + (3 + (i - (neuronCount - 2))) * NEURON_SPACING };
      return { x: xCenter, y: 0 };
    };
    const isVisible = (i: number) => !newCollapsed || i <= 1 || i >= neuronCount - 2;

    setNodes((nds) =>
      nds.map((nd) => {
        if (nd.id === id && nd.type === 'layer') {
          const newHeight = newCollapsed
            ? 5 * NEURON_SPACING + 2 * LAYER_PADDING
            : neuronCount * NEURON_SPACING + 2 * LAYER_PADDING;
          return {
            ...nd,
            data: { ...nd.data, collapsed: newCollapsed },
            style: { ...nd.style, width: 140, height: newHeight },
          };
        }
        if (nd.parentId === id) {
          const idx = parseInt(nd.id.split('-').pop() ?? '0', 10);
          return {
            ...nd,
            position: getChildPosition(idx),
            hidden: !isVisible(idx),
          };
        }
        return nd;
      })
    );
  }, [canCollapse, getNodes, id, setNodes]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleCollapsed();
    },
    [toggleCollapsed]
  );

  return (
    <div
      className={`relative overflow-hidden transition-all duration-300 ${canCollapse ? 'cursor-pointer' : ''}`}
      style={{ width, height, minHeight: 80 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={handleDoubleClick}
      title={canCollapse ? 'Double-click to expand/collapse' : undefined}
    >
      {/* Invisible by default; glow border on hover */}
      <div
        className={`absolute inset-0 rounded-xl transition-all duration-300 ${
          isHovered
            ? 'shadow-[0_0_20px_rgba(56,189,248,0.4),0_0_40px_rgba(56,189,248,0.2),inset_0_0_0_1px_rgba(56,189,248,0.3)]'
            : ''
        }`}
        style={{
          pointerEvents: 'none',
        }}
      />

      {/* Ellipsis placeholder when collapsed */}
      {collapsed && canCollapse && (
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

      {/* Layer handles - always visible, subtle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-[14px] !h-[14px] !bg-cyan-500/70 !border-2 !border-slate-800 !z-20 !top-1/2 !-translate-y-1/2 !left-[-7px] transition-opacity hover:!bg-cyan-400 hover:!scale-110"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-[14px] !h-[14px] !bg-cyan-500/70 !border-2 !border-slate-800 !z-20 !top-1/2 !-translate-y-1/2 !right-[-7px] transition-opacity hover:!bg-cyan-400 hover:!scale-110"
      />
    </div>
  );
};

export default memo(LayerNode);
