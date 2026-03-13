import React from 'react';
import {
    ReactFlow,
    Background,
    type Node,
    type Edge,
    type OnNodesChange,
    type OnEdgesChange,
    type OnConnect,
    type NodeTypes,
    type EdgeTypes,
    type DefaultEdgeOptions,
} from '@xyflow/react';
import { nodeTypes as defaultNodeTypes, edgeTypes as defaultEdgeTypes } from '../../config/nodeGraphConfig';
import { CanvasDropZone } from './CanvasDropZone';
import '@xyflow/react/dist/base.css';


interface ReactFlowLayoutProps {
    nodes: Node[];
    edges: Edge[];
    onNodesChange?: OnNodesChange;
    onEdgesChange?: OnEdgesChange;
    onConnect?: OnConnect;
    onDrop?: (event: React.DragEvent) => void;
    onDragOver?: (event: React.DragEvent) => void;
    nodeTypes?: NodeTypes;
    edgeTypes?: EdgeTypes;
    defaultEdgeOptions?: DefaultEdgeOptions;
    isInteractive?: boolean;
    onEdgeClick?: (event: React.MouseEvent, edge: Edge) => void;
    children?: React.ReactNode;
    fitView?: boolean;
}

export const ReactFlowLayout: React.FC<ReactFlowLayoutProps> = ({
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onDrop,
    onDragOver,
    onEdgeClick,
    nodeTypes = defaultNodeTypes,
    edgeTypes = defaultEdgeTypes,
    defaultEdgeOptions,
    isInteractive = false,
    children,
    fitView = true
}) => {
    return (
        <CanvasDropZone className="flow-wrapper" style={{ width: '100%', height: '100%' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onEdgeClick={onEdgeClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                fitView={fitView}
                nodesDraggable={isInteractive}
                nodesConnectable={isInteractive}
                nodesFocusable={isInteractive}
                edgesFocusable={isInteractive}
                elementsSelectable={true}
                selectionOnDrag={isInteractive}
                panOnDrag={isInteractive ? [1, 2] : undefined}
                panActivationKeyCode="Control"
                deleteKeyCode={['Backspace', 'Delete']}
                className="react-flow-background"
                style={{ backgroundColor: 'var(--color-bg-primary)' }}
                minZoom={0.1}
                maxZoom={10}
            >
                <Background color="#6d6d6dff" gap={16} />
            </ReactFlow>
            {children}
        </CanvasDropZone>
    );
};
