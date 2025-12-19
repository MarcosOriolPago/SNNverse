import React from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import { nodeTypes, edgeTypes, defaultEdgeOptions } from '../config/nodeGraphConfig';
import '@xyflow/react/dist/base.css';


interface NetworkVisualizerProps {
    nodes: any[];
    edges: any[];
    onNodesChange?: (changes: any) => void;
    onEdgesChange?: (changes: any) => void;
    onDrop?: (event: React.DragEvent) => void;
    onDragOver?: (event: React.DragEvent) => void;
}

const NetworkVisualizer: React.FC<NetworkVisualizerProps> = ({
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onDrop,
    onDragOver
}) => {
    return (
        <div style={{ width: '100%', height: '100%' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                nodesFocusable={false}
                edgesFocusable={false}
                elementsSelectable={true}
                className="react-flow-background"
            >
                <Controls />
                <Background color="#6d6d6dff" gap={16} />
            </ReactFlow>
        </div>
    );
};

export default NetworkVisualizer;
