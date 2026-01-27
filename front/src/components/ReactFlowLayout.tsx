import React from 'react';
import {
    ReactFlow,
    Background,
    ReactFlowProvider,
    type Node,
    type Edge,
    type OnNodesChange,
    type OnEdgesChange,
    type OnConnect,
    type NodeTypes,
    type EdgeTypes,
    type DefaultEdgeOptions,
} from '@xyflow/react';
import { nodeTypes as defaultNodeTypes, edgeTypes as defaultEdgeTypes } from '../config/nodeGraphConfig';
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
    nodeTypes = defaultNodeTypes,
    edgeTypes = defaultEdgeTypes,
    defaultEdgeOptions,
    isInteractive = false,
    children,
    fitView = true
}) => {
    return (
        <div className="flow-wrapper" style={{ width: '100%', height: '100%' }}>
            {children}
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onDrop={onDrop}
                onDragOver={onDragOver}
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
            >
                <Background color="#6d6d6dff" gap={16} />
            </ReactFlow>
        </div>
    );
};

