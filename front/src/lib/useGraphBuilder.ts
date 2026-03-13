import { useCallback } from 'react';
import {
    useReactFlow,
    addEdge,
    type Connection,
    type Edge,
    type Node,
} from '@xyflow/react';
import { createSpikeFxNode, createKeyboardNode, createNeuronNode, createLayerPlaceholder } from '../config/nodeGraphConfig';
import type { NeuronNodeData } from '../components/reactFlow/NeuronNode';
import type { InputNodeData } from '../components/reactFlow/PySpikeFx';
import { useNetworkIO } from './useNetworkIO';
import { mapBackendNodesToReactFlow, mapBackendEdgeToReactFlow } from './networkHelpers';
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

        const { nodes: newNodes, idMap } = mapBackendNodesToReactFlow(network.nodes, { x: offsetX, y: offsetY });

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
            const { nodeType = 'neuron', neuronType, parameters, networkName, neuronCount } = parsedData;

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            if (nodeType === 'network' && networkName) {
                await loadNetworkToCanvas(networkName, position);
                return;
            }

            if (nodeType === 'layer') {
                const placeholder = createLayerPlaceholder(
                    position,
                    neuronType ?? 'LIF',
                    (parameters ?? {}) as Record<string, unknown>
                );
                setNodes((nds) => nds.concat(placeholder));
                return;
            }

            let newNode: Node<NeuronNodeData | InputNodeData | any>;

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
            const targetNode = nodes.find((n) => n.id === params.target);
            const sourceIsLayerChild = !!sourceNode?.parentId;
            const targetIsLayerChild = !!targetNode?.parentId;
            const sourceRootId = sourceNode?.parentId ?? params.source;
            const targetRootId = targetNode?.parentId ?? params.target;
            const sourceRootNode = nodes.find((n) => n.id === sourceRootId) ?? sourceNode;
            const targetRootNode = nodes.find((n) => n.id === targetRootId) ?? targetNode;
            const sourceIsLayer = sourceRootNode?.type === 'layer';
            const targetIsLayer = targetRootNode?.type === 'layer';

            let type = 'spike';
            let edgeData: Record<string, unknown> = {};

            if (sourceNode?.type === 'keyboard') {
                type = 'keyboardEdge';
            } else if (sourceIsLayer || targetIsLayer || sourceIsLayerChild || targetIsLayerChild) {
                type = 'synapse';
                edgeData = { connectionType: null };
            }

            const source = type === 'synapse' ? sourceRootId : params.source;
            const target = type === 'synapse' ? targetRootId : params.target;
            const sourceHandle = sourceIsLayer ? 'layer-out' : params.sourceHandle;
            const targetHandle = targetIsLayer ? 'layer-in' : params.targetHandle;

            setEdges((els) => addEdge({ ...params, source, target, sourceHandle, targetHandle, type, data: edgeData }, els));
        },
        [setEdges, nodes],
    );

    const addNodeFromDrop = useCallback(
        async (clientX: number, clientY: number, parsedData: Record<string, unknown>) => {
            if (isCompiling) return;

            const { nodeType = 'neuron', neuronType, parameters, networkName, neuronCount } = parsedData;

            const position = screenToFlowPosition({ x: clientX, y: clientY });

            if (nodeType === 'network' && networkName) {
                await loadNetworkToCanvas(networkName as string, position);
                return;
            }

            if (nodeType === 'layer') {
                const placeholder = createLayerPlaceholder(
                    position,
                    (neuronType as string) ?? 'LIF',
                    (parameters as Record<string, unknown>) ?? {}
                );
                setNodes((nds) => nds.concat(placeholder));
                return;
            }

            let newNode: Node<NeuronNodeData | InputNodeData | any>;

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
                newNode = createNeuronNode(position, neuronType as string, parameters as Record<string, unknown>);
            }

            setNodes((nds) => nds.concat(newNode));
        },
        [screenToFlowPosition, setNodes, isCompiling, loadNetworkToCanvas],
    );

    return { onDragOver, onDrop, onConnect, loadNetworkToCanvas, addNodeFromDrop };
};
