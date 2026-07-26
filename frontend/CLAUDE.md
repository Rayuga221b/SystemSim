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
- Never hardcode chrome colors (`white/[alpha]` borders, `#hex` grays, etc.).
  `base/surface/elevated/dim/ink/muted/hairline` are CSS-var-backed
  (`index.css` `:root`) so every usage stays consistent — see
  `frontend/DESIGN.md` "Color tokens". Dark technical is the app's only
  theme (DECISION 2026-07-26: the light theme + toggle were removed — see
  DESIGN.md Decisions). The one deliberate exception is a fixed-dark surface
  that must never repaint (e.g. `SplashLoader.jsx`, `ComponentCard.jsx`'s
  always-dark gradient tiles) — those use literal hex/white, not the tokens.
