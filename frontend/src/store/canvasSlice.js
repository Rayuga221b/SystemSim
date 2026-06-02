// Nodes, edges, selection. Optimistic — updates apply instantly.
export const createCanvasSlice = (set) => ({
  nodes: [],
  edges: [],
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  // TODO: addNode, updateNodeConfig, connect, removeNode
});
