// Canvas state: React Flow nodes/edges + graph operations.
// Optimistic — every edit applies instantly; simulation results reconcile
// node styling afterwards (see simulationSlice).
import { applyNodeChanges, applyEdgeChanges, addEdge } from "reactflow";
import { defaultConfig, COMPONENT_BY_TYPE } from "@/lib/components";

let idCounter = 0;
const nextId = (type) => `${type}_${Date.now().toString(36)}_${idCounter++}`;

export const createCanvasSlice = (set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  dirty: false, // unsaved changes since last save/load
  graphVersion: 0, // bumped when a whole graph is loaded — canvas re-fits view

  // React Flow controlled-mode handlers
  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes), dirty: true })),
  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges), dirty: true })),
  onConnect: (connection) =>
    set((s) => ({
      edges: addEdge(
        { ...connection, id: `e_${connection.source}__${connection.target}`, type: "system" },
        s.edges
      ),
      dirty: true,
    })),

  addNode: (type, position) => {
    const comp = COMPONENT_BY_TYPE[type];
    if (!comp) return;
    const id = nextId(type);
    const node = {
      id,
      type: "system", // single custom React Flow node type; component type lives in data
      position,
      data: { type, label: comp.label, config: defaultConfig(type) },
    };
    set((s) => ({ nodes: [...s.nodes, node], selectedNodeId: id, dirty: true }));
  },

  updateNodeConfig: (nodeId, key, value) =>
    set((s) => ({
      dirty: true,
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: value } } }
          : n
      ),
    })),

  renameNode: (nodeId, label) =>
    set((s) => ({
      dirty: true,
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, label } } : n
      ),
    })),

  removeNode: (nodeId) =>
    set((s) => ({
      dirty: true,
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
    })),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  clearCanvas: () =>
    set({ nodes: [], edges: [], selectedNodeId: null, dirty: false }),

  /** Serialize canvas → the graph JSON the backend engine expects. */
  serializeGraph: () => {
    const { nodes, edges } = get();
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.data.type,
        label: n.data.label,
        config: n.data.config,
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    };
  },

  /** Load a backend graph JSON (starter graphs, saved designs) onto the canvas.
      Accepts either engine-shape nodes ({type, config}) or saved React Flow shape. */
  loadGraph: (graph) => {
    if (!graph?.nodes) return;
    const isEngineShape = graph.nodes[0] && !graph.nodes[0].data;
    const nodes = graph.nodes.map((n, i) =>
      isEngineShape
        ? {
            id: n.id,
            type: "system",
            position: n.position || autoPosition(i, graph.nodes.length),
            data: {
              type: n.type,
              label: n.label || COMPONENT_BY_TYPE[n.type]?.label || n.type,
              config: { ...defaultConfig(n.type), ...(n.config || {}) },
            },
          }
        : { ...n, type: "system" }
    );
    const edges = graph.edges.map((e) => ({
      id: e.id || `e_${e.source}__${e.target}`,
      source: e.source,
      target: e.target,
      type: "system",
    }));
    set((s) => ({ nodes, edges, selectedNodeId: null, dirty: false, graphVersion: s.graphVersion + 1 }));
  },
});

// Fallback layout when a starter graph carries no positions: left→right lanes.
function autoPosition(index, total) {
  const col = index;
  return { x: 80 + col * 220, y: 200 + (index % 2 === 0 ? 0 : 90) };
}
