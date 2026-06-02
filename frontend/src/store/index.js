import { create } from "zustand";
import { createCanvasSlice } from "./canvasSlice";
import { createSimulationSlice } from "./simulationSlice";
import { createUiSlice } from "./uiSlice";
import { createAuthSlice } from "./authSlice";

export const useStore = create((...a) => ({
  ...createCanvasSlice(...a),
  ...createSimulationSlice(...a),
  ...createUiSlice(...a),
  ...createAuthSlice(...a),
}));
