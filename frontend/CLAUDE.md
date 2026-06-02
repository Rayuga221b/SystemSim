# Frontend — conventions

React + Vite. Loaded when working in `frontend/`.

## Layout

- `src/components/canvas/` — React Flow nodes, edges, canvas wrapper
- `src/components/sidebar/` — component palette, search, categories
- `src/components/panels/` — properties panel, results panel, AI panel
- `src/components/ui/` — shadcn primitives (don't hand-edit; regenerate)
- `src/pages/` — Home, Sandbox, Challenges, CaseStudies, Dashboard
- `src/api/` — every network call lives here. No `fetch` outside this folder.
- `src/store/` — Zustand slices: `canvasSlice`, `simulationSlice`, `uiSlice`, `authSlice`
- `src/lib/` — helpers, constants (incl. the 14 component definitions), supabase client

## Rules

- One custom React Flow node component per system component; share a base.
- Component metadata (label, category, configurable fields) lives in
  `lib/components.js` as data — nodes render from it, palette reads from it.
- Canvas updates optimistically; simulation results reconcile node styling.
- Tailwind for layout, shadcn/ui for primitives. No other UI kit.
- Keep API response types mirrored from `docs/spec.md` output schema.
- State that's purely visual (panel open/closed) → `uiSlice`, not local state
  if more than one component needs it.
