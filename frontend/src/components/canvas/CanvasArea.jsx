// The React Flow canvas wrapper: drop target for palette items, custom node
// and edge types, dark-styled chrome. Must live under a <ReactFlowProvider>.
import { useCallback, useEffect } from "react";
import ReactFlow, { Background, BackgroundVariant, Controls, MiniMap, useReactFlow } from "reactflow";
import "reactflow/dist/style.css";
import { useStore } from "@/store";
import { CATEGORY_COLOR, COMPONENT_BY_TYPE } from "@/lib/components";
import SystemNode from "./SystemNode";
import SystemEdge from "./SystemEdge";

const nodeTypes = { system: SystemNode };
const edgeTypes = { system: SystemEdge };

export default function CanvasArea() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const onNodesChange = useStore((s) => s.onNodesChange);
  const onEdgesChange = useStore((s) => s.onEdgesChange);
  const onConnect = useStore((s) => s.onConnect);
  const addNode = useStore((s) => s.addNode);
  const selectNode = useStore((s) => s.selectNode);

  const graphVersion = useStore((s) => s.graphVersion);

  const { screenToFlowPosition, fitView } = useReactFlow();

  // Re-center whenever a whole graph is swapped in (presets, saved designs,
  // case-study starters).
  useEffect(() => {
    if (graphVersion > 0) {
      // wait one frame so React Flow has the new nodes measured
      requestAnimationFrame(() => fitView({ padding: 0.25, maxZoom: 1, duration: 300 }));
    }
  }, [graphVersion, fitView]);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/systemsim-node");
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(type, { x: position.x - 89, y: position.y - 24 }); // center under cursor
    },
    [screenToFlowPosition, addNode]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={(_, node) => selectNode(node.id)}
      onPaneClick={() => selectNode(null)}
      onDrop={onDrop}
      onDragOver={onDragOver}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={{ type: "system" }}
      deleteKeyCode={["Backspace", "Delete"]}
      fitView
      fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
      minZoom={0.3}
      maxZoom={1.75}
      proOptions={{ hideAttribution: true }}
      className="canvas-surface"
    >
      {/* Two-layer "blueprint" grid — n8n-style: a fine dot lattice plus a
          coarser, brighter grid every 5 cells for a sense of depth and scale
          as you pan/zoom, instead of one flat repeating dot. */}
      <Background id="grid-fine"   variant={BackgroundVariant.Dots} gap={26}  size={1.3} color="rgba(124, 92, 255,0.20)" />
      <Background id="grid-coarse" variant={BackgroundVariant.Dots} gap={130} size={2.4} color="rgba(155, 133, 255,0.32)" />
      <Controls position="bottom-left" showInteractive={false} />
      <MiniMap
        position="bottom-right"
        pannable
        zoomable
        maskColor="rgba(9,9,14,0.82)"
        style={{ backgroundColor: "#101016", border: "1px solid #1C1C2A", borderRadius: 8 }}
        nodeColor={(n) => CATEGORY_COLOR[COMPONENT_BY_TYPE[n.data?.type]?.category] || "#7C5CFF"}
        nodeStrokeWidth={0}
      />
    </ReactFlow>
  );
}
