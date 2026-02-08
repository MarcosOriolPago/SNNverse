import { useCallback } from 'react';
import {
    useReactFlow,
    addEdge,
    type Connection,
    type Edge,
    type Node,
} from '@xyflow/react';
import { createSpikeFxNode, createKeyboardNode, createNeuronNode } from '../config/nodeGraphConfig';
import type { NeuronNodeData } from '../components/reactFlow/NeuronNode';
import type { InputNodeData } from '../components/reactFlow/PySpikeFx';
import { useNetworkIO } from './useNetworkIO';
import { mapBackendNodeToReactFlow, mapBackendEdgeToReactFlow } from './networkHelpers';
interface UseGraphBuilderProps {
    nodes: Node[];
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
    isCompiling: boolean;
}

export const useGraphBuilder = ({ nodes, setNodes, setEdges, isCompiling }: UseGraphBuilderProps) => {
    const { screenToFlowPosition } = useReactFlow();
    const { loadNetwork } = useNetworkIO();

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = isCompiling ? 'none' : 'move';
    }, [isCompiling]);

    const loadNetworkToCanvas = useCallback(async (networkName: string, dropPosition: { x: number, y: number }) => {
        const network = await loadNetwork(networkName);
        if (!network || !network.nodes || network.nodes.length === 0) return;

        let minX = Infinity;
        let minY = Infinity;
        network.nodes.forEach((n: any) => {
            if (n.position.x < minX) minX = n.position.x;
            if (n.position.y < minY) minY = n.position.y;
        });

        const offsetX = dropPosition.x - minX;
        const offsetY = dropPosition.y - minY;

        const newNodes = network.nodes.map((n: any) => mapBackendNodeToReactFlow(n, { x: offsetX, y: offsetY }));

        const idMap: Record<string, string> = {};
        network.nodes.forEach((n: any, i: number) => {
            idMap[n.id] = newNodes[i].id;
        });

        const newEdges = network.edges.map((e: any) => mapBackendEdgeToReactFlow(e, idMap));

        setNodes((nds) => nds.concat(newNodes));
        setEdges((eds) => eds.concat(newEdges));

    }, [loadNetwork, setNodes, setEdges]);


    const onDrop = useCallback(
        async (event: React.DragEvent) => {
            event.preventDefault();

            if (isCompiling) return;

            const typeData = event.dataTransfer.getData('application/reactflow');
            if (!typeData) return;

            const parsedData = JSON.parse(typeData);
            const { nodeType = 'neuron', neuronType, parameters, networkName } = parsedData;

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            if (nodeType === 'network' && networkName) {
                await loadNetworkToCanvas(networkName, position);
                return;
            }

            let newNode: Node<NeuronNodeData | InputNodeData | any>;

            console.log("NodeType:", nodeType)
            if (nodeType === 'spike_fx') {
                newNode = createSpikeFxNode(position);
            } else if (nodeType === 'keyboard') {
                newNode = createKeyboardNode(position);
            } else if (nodeType === 'output-display' || nodeType === 'monitor') {
                newNode = {
                    id: `monitor-${Date.now()}`,
                    type: 'monitor',
                    position,
                    data: { label: 'Signal Monitor' }
                };
            } else {
                newNode = createNeuronNode(position, neuronType, parameters);
            }

            setNodes((nds) => nds.concat(newNode));
        },
        [screenToFlowPosition, setNodes, isCompiling, loadNetworkToCanvas],
    );

    const onConnect = useCallback(
        (params: Connection) => {
            const sourceNode = nodes.find((n) => n.id === params.source);
            let type = 'spike';
            if (sourceNode?.type === 'keyboard') {
                type = 'keyboardEdge';
            }
            setEdges((els) => addEdge({ ...params, type, data: {} }, els));
        },
        [setEdges, nodes],
    );

    return { onDragOver, onDrop, onConnect, loadNetworkToCanvas };
};
