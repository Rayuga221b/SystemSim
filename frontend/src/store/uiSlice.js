// Purely visual state shared across components (panels open/closed, etc).
export const createUiSlice = (set) => ({
  propertiesPanelOpen: false,
  resultsPanelOpen: false,
  aiPanelOpen: false,
  toggle: (key) => set((s) => ({ [key]: !s[key] })),
});
