# Design System — SystemSim

## Register

Product (design serves the tool; clarity over decoration).

## Theme

Dark technical. The scene: an engineer in a focused study session. Not a marketing page — a real tool. Borrowed cues from Linear and Figma.

## Color tokens

| Token      | Value     | Usage                                      |
|------------|-----------|--------------------------------------------|
| `base`     | `#0B0E14`  | Page background                            |
| `surface`  | `#12161F`  | Card / panel backgrounds                   |
| `elevated` | `#1A2030`  | Raised surfaces, hover backgrounds         |
| `dim`      | `#262E42`  | Borders, dividers                          |
| `ink`      | `#F3F5FA`  | Primary text (high contrast)               |
| `muted`    | `#8D97B0`  | Secondary text (≥4.5:1 on base/surface)    |

Brand accent: `indigo-500` (#7C5CFF — violet; the Tailwind `indigo` scale is
fully overridden in `tailwind.config.js`, so every existing `indigo-*` class
repaints without renaming). Used for interactive elements, current state
indicators, and primary actions only — not decoration.

Second accent: `mint` (#34E2A1). Reserved strictly for "healthy" /
"simulating" states (sandbox node status, results panel). Never decorative —
if it's on screen, something is actually good or actively running.

Warning / bottleneck: `amber-400` (#FBBF24). Semantic only.

No third gradient accent. Cyan (#06B6D4) is retired from the palette.

## Typography

| Role          | Family           | Weight | Notes                              |
|---------------|------------------|--------|------------------------------------|
| Display/heads | Space Grotesk    | 600    | Page h1/h2 only. Max 2.875rem.     |
| Body + UI     | DM Sans          | 400/500/600 | All body, labels, buttons       |
| Technical     | Space Mono       | 400    | Tags, metrics, counters, metadata  |
| Reading       | Source Serif 4   | 400/500/600 | `font-read` — long-form prose only (case-study Problem/Solution, Learn chapters, via `<Prose>`). Never headings or UI chrome. |

Rules:
- No gradient text on headings or any element. Solid `text-ink` for headings.
- `tracking-[-0.02em]` on display headings. No tighter.
- `text-wrap: balance` on h1–h2.
- Body max line-length: 52ch for prose, 70ch absolute ceiling.
- `font-read` is the one exception to "UI font everywhere" — it exists so
  reading-length paragraphs feel like an article, not a control. If it's a
  label, button, or heading, it's never `font-read`.

## Buttons

**Primary (CTA):** `.btn-primary` — `linear-gradient(135deg, #7C5CFF, #9B85FF)`, white text. Rounded-lg. Never on text nodes.

**Ghost:** `border border-dim hover:border-indigo-500/35 hover:bg-elevated`, ink text.

**Filter/segment:** `bg-indigo-500/12 text-indigo-300 border border-indigo-500/30` when active. `text-muted hover:text-ink hover:bg-elevated` when inactive.

## Cards / surfaces

- `bg-surface border border-dim rounded-xl` — base card.
- Hover: `hover:bg-elevated/35` on list rows (NOT shadow + border together).
- No `box-shadow` paired with `border` on the same element.
- Border-radius ceiling: 12px on cards, 8px on inputs. Pills/tags at 4px (rounded).

## Icons

Lucide React, 14–18px. `text-indigo-400/70` for accented. `text-muted` for secondary.

## Layout patterns

- Page content max-width: `max-w-4xl` (896px).
- Horizontal padding: `px-6`.
- Section spacing: `py-14` to `py-20`.
- List rows: full-width, `border-b border-dim`, hover `bg-elevated/35`.
- No identical card grids — use list layout for Challenges and CaseStudies.

## Motion

- `animate-fade-up` on hero content (initial load only, not scroll-gated).
- `animate-marquee` on company carousel.
- All transitions: `duration-150`, ease default.
- `prefers-reduced-motion` handled in `index.css` — all animations disabled.

## Absolute bans (still in force)

- Gradient text (`background-clip: text` with gradient).
- Uppercase tracked eyebrow above every section.
- Identical same-sized card grids repeated page to page.
- `box-shadow` (> 8px blur) paired with `border` on the same element.
- Nebula / decorative blur blobs.
- Mint used as decoration instead of a "healthy/simulating" signal.

## Logo

`src/components/ui/Logo.jsx` — inline SVG, not an `<img>`. "Pulse Node": three
graph nodes tracing an S, the center one mint and (optionally) pulsing. Same
shape language as what a user draws on the canvas — the mark *is* the
product, not a picture of it. Favicon lives at `public/logo.svg`
(`public/logo.png` / `apple-touch-icon.png` are rasterized fallbacks — see
`design/systemsim-design-portfolio.html` for the full exploration, including
two rejected directions).

## Decisions

**Visual rebrand — DECISION (2026-07-08):** Satyam reviewed a from-scratch
design exploration (`design/systemsim-design-portfolio.html`) and asked for
several pieces of it folded into the real app:

- New logo ("Pulse Node") replacing the old triangle mark, everywhere
  (Navbar, Footer, SplashLoader, favicon).
- Brand accent moved from indigo (#6366F1) to violet (#7C5CFF) — done via a
  full override of Tailwind's `indigo` scale in `tailwind.config.js`, so
  every existing `indigo-*` class in the app repaints without a rename.
- New `mint` (#34E2A1) token added as a second accent, strictly for
  "healthy / simulating" states — sandbox node status ring + utilization
  bar, nothing decorative.
- Base/surface/elevated/dim/ink/muted all shifted slightly (warmer, bluer
  dark) — see table above.
- Navbar shape changed from a floating rounded pill to a flat full-width
  sticky bar with a bottom border, matching the mockup — fonts untouched
  (still Space Grotesk for logo/nav labels).
- New `font-read` (Source Serif 4) token added for long-form prose only
  (`Prose.jsx`, plus a few pull-quotes/callouts in `CaseStudyDetail.jsx` and
  `Learn.jsx`) so reading-length content is visually distinct from UI
  chrome. Every other font is unchanged.
- Sandbox nodes (`SystemNode.jsx`) now show a category-colored outline by
  default (was a neutral border) — you can tell what a node *is* before you
  ever hit Simulate; status/selection still override once present.
- Palette sidebar simplified to flat list rows (dot + label, no card/border
  chrome) per the mockup's grouped sidebar concept.
- Challenge brief (`ChallengePlay.jsx`) restructured around a Problem /
  Solution two-card pattern, echoing `CaseStudyDetail.jsx`'s existing
  Problem → Solution structure.
