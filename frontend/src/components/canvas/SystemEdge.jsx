// Custom edge: bezier with a subtle animated "flow" dash so the canvas feels
// alive. Turns red when the target node is overloaded/failed after a sim.
import { memo } from "react";
import { BaseEdge, getBezierPath } from "reactflow";
import { useStore } from "@/store";

function SystemEdge({ id, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected }) {
  const targetStatus = useStore((s) => s.simResult?.node_statuses?.[target]);

  const [path] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  const stressed = targetStatus === "overloaded" || targetStatus === "failed";
  const stroke = stressed
    ? "rgba(239,68,68,0.75)"
    : selected
    ? "rgba(155, 133, 255,0.9)"
    : "rgba(124, 92, 255,0.45)";

  return (
    <>
      {/* static base line */}
      <BaseEdge id={id} path={path} style={{ stroke, strokeWidth: 1.5 }} />
      {/* animated dash overlay */}
      <path
        d={path}
        fill="none"
        className="edge-flow"
        style={{ stroke, strokeWidth: 1.5 }}
        aria-hidden
      />
    </>
  );
}

export default memo(SystemEdge);
