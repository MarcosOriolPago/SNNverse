import React, { type FC } from 'react';
import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath, useReactFlow } from '@xyflow/react';

const KeyboardEdge: FC<EdgeProps> = ({
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
    const [isListening, setIsListening] = React.useState(false);

    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    React.useEffect(() => {
        if (!isListening) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const key = e.key === " " ? "Space" : e.key;

            setEdges((edges) => edges.map((edge) => {
                if (edge.id === id) {
                    return { ...edge, data: { ...edge.data, key } };
                }
                return edge;
            }));

            setIsListening(false);
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isListening, id, setEdges]);

    const onEdgeClick = (evt: React.MouseEvent) => {
        evt.stopPropagation();
        setIsListening(true);
    };

    const keyLabel = isListening ? "Press Key..." : ((data?.key as string) || "Click to Map");
    const isMapped = !!data?.key;

    return (
        <>
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    ...style,
                    stroke: (isMapped || isListening) ? '#a855f7' : '#64748b',
                    strokeWidth: (isMapped || isListening) ? 2 : 1,
                    strokeDasharray: isListening ? '5,5' : undefined,
                    animation: isListening ? 'dashdraw 0.5s linear infinite' : undefined
                }}
            />
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
                    <button
                        className={`px-2 py-1 rounded border shadow-md text-xs font-mono transition-transform active:scale-95 ${isListening
                            ? 'bg-purple-600 border-purple-400 text-white shadow-glow-primary scale-110'
                            : isMapped
                                ? 'bg-slate-900 border-purple-500 text-purple-300 hover:bg-slate-800 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                                : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                            }`}
                        onClick={onEdgeClick}
                        title="Click to map key"
                    >
                        {keyLabel}
                    </button>
                </div>
            </EdgeLabelRenderer>
        </>
    );
};

export default KeyboardEdge;
