import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "reactflow";

export default function VectorEdge({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  style = {}, data,
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} style={style} />

      {/* Traveling dot: SVG animateMotion along the bezier path */}
      {data?.active && (
        <circle r="4.5" fill="#22D3EE" style={{ filter: "drop-shadow(0 0 5px #22D3EE)" }}>
          <animateMotion dur="1.1s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {/* Static midpoint label */}
      {data?.active && (
        <EdgeLabelRenderer>
          <span
            className="vector-label"
            style={{ transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)` }}
          >
            3 KB
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
