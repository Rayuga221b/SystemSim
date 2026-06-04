# Design System — SystemSim

## Register

Product (design serves the tool; clarity over decoration).

## Theme

Dark technical. The scene: an engineer in a focused study session. Not a marketing page — a real tool. Borrowed cues from Linear and Figma.

## Color tokens

| Token      | Value     | Usage                                      |
|------------|-----------|--------------------------------------------|
| `base`     | `#09090E`  | Page background                            |
| `surface`  | `#101016`  | Card / panel backgrounds                   |
| `elevated` | `#15151C`  | Raised surfaces, hover backgrounds         |
| `dim`      | `#1C1C2A`  | Borders, dividers                          |
| `ink`      | `#EDEDF2`  | Primary text (high contrast)               |
| `muted`    | `#808098`  | Secondary text (≥4.5:1 on base/surface)    |

Brand accent: `indigo-500` (#6366F1). Used for interactive elements, current state indicators, and primary actions only — not decoration.

Warning / bottleneck: `amber-400` (#FBBF24). Semantic only.

No second gradient accent. Cyan (#06B6D4) is retired from the palette.

## Typography

| Role          | Family           | Weight | Notes                              |
|---------------|------------------|--------|------------------------------------|
| Display/heads | Space Grotesk    | 600    | Page h1/h2 only. Max 2.875rem.     |
| Body + UI     | Inter            | 400/500/600 | All body, labels, buttons       |
| Technical     | JetBrains Mono   | 400    | Tags, metrics, counters, metadata  |

Rules:
- No gradient text on headings or any element. Solid `text-ink` for headings.
- `tracking-[-0.02em]` on display headings. No tighter.
- `text-wrap: balance` on h1–h2.
- Body max line-length: 52ch for prose, 70ch absolute ceiling.

## Buttons

**Primary (CTA):** `.btn-primary` — `linear-gradient(135deg, #6366F1, #818CF8)`, white text. Rounded-lg. Never on text nodes.

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
- The cyan/indigo gradient combo as a brand signature.
