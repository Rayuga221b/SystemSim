// Simulation state: load settings, failure injection, results, AI explanation.
// runSimulation is the one fast loop the whole product is built around.
import { api } from "@/api/client";

export const createSimulationSlice = (set, get) => ({
  loadRps: 1000,
  readPct: 80,
  failures: {}, // node_id -> failure mode
  simRunning: false,
  simPhase: null, // "propagating" | "measuring" | "analyzing" while running
  simResult: null,
  simError: null,

  // AI explanation of the last result — structured from the backend:
  // { summary, bottlenecks: [{node_id, label, why, fix}], suggested_fixes }
  explainLoading: false,
  explanation: null,
  explainError: null,

  setLoadRps: (loadRps) => set({ loadRps }),
  setReadPct: (readPct) => set({ readPct }),

  toggleFailure: (nodeId, mode) =>
    set((s) => {
      const failures = { ...s.failures };
      if (failures[nodeId] === mode) delete failures[nodeId];
      else failures[nodeId] = mode;
      return { failures };
    }),
  clearFailures: () => set({ failures: {} }),

  clearSimResult: () =>
    set({ simResult: null, simError: null, explanation: null, explainError: null, explainOpen: false }),

  runSimulation: async () => {
    const { serializeGraph, loadRps, readPct, failures } = get();
    const graph = serializeGraph();
    if (!graph.nodes.some((n) => n.type === "client")) {
      set({ simError: "Add a Client node — the simulation needs a traffic source.", simResult: null });
      return;
    }
    set({ simRunning: true, simPhase: "propagating", simError: null, explanation: null, explainError: null, explainOpen: false });

    // The engine answers in ~10ms, which reads as "preloaded" and cheapens the
    // result. Stage the run over ~1.4s with honest-sounding phases so the user
    // feels the system doing the work the engine actually does.
    const phases = ["propagating", "measuring", "analyzing"];
    let phaseIdx = 0;
    const phaseTimer = setInterval(() => {
      phaseIdx = Math.min(phaseIdx + 1, phases.length - 1);
      if (get().simRunning) set({ simPhase: phases[phaseIdx] });
    }, 480);
    const started = Date.now();
    const MIN_RUN_MS = 1400;

    try {
      const result = await api.simulate(graph, loadRps, {
        failures: Object.keys(failures).length ? failures : undefined,
        workload: { read_pct: readPct },
      });
      const remaining = MIN_RUN_MS - (Date.now() - started);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      set({ simResult: result, simRunning: false, simPhase: null });
    } catch (err) {
      set({ simError: err.message, simRunning: false, simPhase: null, simResult: null });
    } finally {
      clearInterval(phaseTimer);
    }
  },

  // Open the AI drawer and fetch the explanation for the current result.
  // Cached per result (a new run clears it) — reopening is free, and retrying
  // after an error just calls this again.
  explainSimulation: async () => {
    const { serializeGraph, simResult, explanation, explainLoading } = get();
    if (!simResult) return;
    set({ explainOpen: true });
    if (explanation || explainLoading) return;
    set({ explainLoading: true, explainError: null });
    try {
      const res = await api.explain(serializeGraph(), simResult);
      set({ explanation: res, explainLoading: false });
    } catch (err) {
      // 503 covers both "no key configured" and "provider over quota" —
      // don't claim it's unconfigured when it may just need a minute.
      const msg = err.status === 503
        ? "The AI mentor isn't available right now — the server may be missing an API key or briefly over its quota. Try again in a minute."
        : err.message;
      set({ explainError: msg, explainLoading: false });
    }
  },
});
