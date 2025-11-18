import { getBezierPath, BaseEdge, type EdgeProps } from '@xyflow/react';

export default function SpikeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const xEqual = sourceX === targetX;
  const yEqual = sourceY === targetY;

  const [edgePath] = getBezierPath({
    // We need this little hack in order to display the gradient for a straight line
    sourceX: xEqual ? sourceX + 0.0001 : sourceX,
    sourceY: yEqual ? sourceY + 0.0001 : sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {/* The Base Connection Line */}
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />

      {/* The "Spike" Signal */}
      <circle 
        r="3" 
        fill="#6b7280"
        stroke="#ffffff"
        opacity="0.5"
      >
        <animateMotion
          dur="2s" // How fast the spike travels
          repeatCount="indefinite" // Loops forever
          path={edgePath} // Follows the specific bezier curve
          rotate="auto"
        />
      </circle>
    </>
  );
}