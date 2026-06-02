// Last simulation result + load setting. Result arrives async.
export const createSimulationSlice = (set) => ({
  loadRps: 1000,
  result: null,
  running: false,
  setLoadRps: (loadRps) => set({ loadRps }),
  setResult: (result) => set({ result }),
  setRunning: (running) => set({ running }),
});
