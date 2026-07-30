// Purely visual state shared across components (panel visibility, drawers).
export const createUiSlice = (set) => ({
  paletteOpen: true,
  resultsOpen: false,   // opens automatically after a simulation
  learnComponent: null, // component type whose concept card is open, or null
  saveModalOpen: false,
  explainOpen: false,   // AI explanation drawer (fetch state lives in simulationSlice)
  chatOpen: false,      // floating AI assistant (FloatingChat.jsx) — lifted to
                        // the store so other panels (e.g. ResultsPanel) can open it

  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setResultsOpen: (open) => set({ resultsOpen: open }),
  setExplainOpen: (open) => set({ explainOpen: open }),
  openLearn: (type) => set({ learnComponent: type }),
  closeLearn: () => set({ learnComponent: null }),
  setSaveModalOpen: (open) => set({ saveModalOpen: open }),
  setChatOpen: (open) => set({ chatOpen: open }),
});
