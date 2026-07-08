// Purely visual state shared across components (panel visibility, drawers).
export const createUiSlice = (set) => ({
  paletteOpen: true,
  resultsOpen: false,   // opens automatically after a simulation
  learnComponent: null, // component type whose concept card is open, or null
  saveModalOpen: false,

  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setResultsOpen: (open) => set({ resultsOpen: open }),
  openLearn: (type) => set({ learnComponent: type }),
  closeLearn: () => set({ learnComponent: null }),
  setSaveModalOpen: (open) => set({ saveModalOpen: open }),
});
