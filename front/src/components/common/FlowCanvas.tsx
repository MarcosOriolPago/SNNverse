import React from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    type Node,
    type Edge,
    type OnNodesChange,
    type OnEdgesChange,
    type OnConnect,
    type NodeTypes,
    type EdgeTypes,
    type DefaultEdgeOptions,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';

// Styles



interface FlowCanvasProps {
    nodes: Node[];
    edges: Edge[];
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect?: OnConnect;
    onDrop?: (event: React.DragEvent) => void;
    onDragOver?: (event: React.DragEvent) => void;
    nodeTypes: NodeTypes;
    edgeTypes: EdgeTypes;
    defaultEdgeOptions?: DefaultEdgeOptions;
    isInteractive?: boolean; // Controls connectable, draggable, etc.
    children?: React.ReactNode; // For overlays like controls
    fitView?: boolean;
}

const FlowCanvas: React.FC<FlowCanvasProps> = ({
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onDrop,
    onDragOver,
    nodeTypes,
    edgeTypes,
    defaultEdgeOptions,
    isInteractive = true,
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
                elementsSelectable={isInteractive}
                selectionOnDrag={isInteractive}
                panOnDrag={[1, 2]}
                panActivationKeyCode="Control"
                deleteKeyCode={['Backspace', 'Delete']}
                className="react-flow-background"
            >
                <Background color="#6d6d6dff" gap={16} />
            </ReactFlow>
        </div>
    );
};

export default FlowCanvas;
