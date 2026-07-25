# Design System — SystemSim

## Register

Product (design serves the tool; clarity over decoration).

## Theme

Dark technical is the default/primary identity — the scene: an engineer in a
focused study session. Not a marketing page — a real tool. Borrowed cues from
Linear and Figma. Light mode is a full, supported second theme (see "Light /
dark mode" under Decisions) — dark is just what a fresh session opens to.

## Color tokens

All six are CSS variables (`--color-*` in `index.css`, RGB triplets), not
static hex — `tailwind.config.js` maps them through
`rgb(var(--color-x) / <alpha-value>)` so opacity modifiers (`bg-surface/50`)
keep working. `:root` holds the dark values (below); `:root.light` overrides
all of them at once. next-themes toggles the `.light` class on `<html>`.

| Token      | Dark value | Light value | Usage                                      |
|------------|-----------|-------------|---------------------------------------------|
| `base`     | `#0B0E14`  | `#F8F9FC`  | Page background                            |
| `surface`  | `#12161F`  | `#FFFFFF`  | Card / panel backgrounds                   |
| `elevated` | `#1A2030`  | `#F1F2F8`  | Raised surfaces, hover backgrounds         |
| `dim`      | `#262E42`  | `#DFE2EC`  | Borders, dividers                          |
| `ink`      | `#F3F5FA`  | `#12151F`  | Primary text (high contrast)               |
| `muted`    | `#8D97B0`  | `#5B6478`  | Secondary text (≥4.5:1 on base/surface)    |

`hairline` (also CSS-var-backed: white in dark mode, `#0F121A`-ish in light)
replaces the old habit of hand-rolling a hairline border/hover wash with
`white/[alpha]` directly on an element — that only worked because the page
was assumed to always be dark. Use `border-hairline/[0.06]`,
`hover:bg-hairline/[0.05]`, etc.; never reach for bare `white/[alpha]` for
chrome again (it's still correct for things like `SplashLoader`, which is
intentionally dark in both themes — see Decisions).

Brand accent: `indigo-500` (#7C5CFF — violet; the Tailwind `indigo` scale is
fully overridden in `tailwind.config.js`, so every existing `indigo-*` class
repaints without renaming). Used for interactive elements, current state
indicators, and primary actions only — not decoration. Steps `200`/`300`/`400`
of that scale (and the equivalent light steps of `amber`/`emerald`/`sky`/`red`
— `300`/`400`, plus `red-500`) are ALSO CSS-var-backed, because those are the
steps used as text/link color: fine light-on-dark, but the same lightness is
1.4–2.8:1 on a light bg. Light mode swaps them for darker steps of the same
scale (5–9:1). Everything else in each scale (50/100/500/600/700/800/900/950)
stays a static hex — only the shades actually used as text needed the swap.

Second accent: `mint` (#34E2A1). Reserved strictly for "healthy" /
"simulating" states (sandbox node status, results panel). Never decorative —
if it's on screen, something is actually good or actively running.

Warning / bottleneck: `amber-400` (#FBBF24 dark / `#B45309` light). Semantic only.

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

**Learn platform + code-reading polish — DECISION (2026-07-16):** The Learn
area became the product's front door, and lesson code needed to read like real
code. Changes, with the reasoning worth being able to speak to:

- **Information architecture: Learn is now the entry point.** Navbar order is
  `Learn → Sandbox → Challenges → Case Studies → Dashboard` (Learn moved ahead
  of Sandbox). Interview prep is no longer a top-level nav item — it moved
  *under* Learn at `/learn/interview`, reached from a link-card on the Learn
  page. Old `/interview` links `<Navigate replace>` to the new path so nothing
  breaks. WHY: the site is a structured learning platform now, not just a
  simulator; the nav should lead with the library, and interview prep is one
  facet of learning, not a peer pillar.
- **Markdown lesson renderer (`components/ui/Markdown.jsx`) is the one place
  long-form lessons are styled.** It maps every GFM element to design tokens
  (kept separate from `Prose.jsx`, which only handles flat bold/italic/inline
  paragraphs). Two code-block treatments, chosen by fence language:
  - **Syntax-highlighted blocks** (```` ```sql ````, `js`, `json`, …) use the
    **VS Code "Dark+" theme** via `rehype-highlight` + `highlight.js/styles/
    vs2015.css`. The custom `code` renderer passes `className` (`hljs
    language-…`) and children through untouched so the theme's token `<span>`s
    survive; the wrapper only owns the `#0b0a14` chrome. GOTCHA to remember:
    the plugin must be wired as `rehypePlugins={[rehypeHighlight]}` on
    `<ReactMarkdown>` — importing it isn't enough (that bug shipped briefly and
    left code uncolored).
  - **Language-less fences** (```` ``` ````) are treated as CLI/terminal
    sessions and get **terminal chrome**: mac-style red/amber/green dot row, a
    "terminal" label, an indigo left-accent, and a darker `#060510` canvas —
    visibly distinct from syntax blocks. WHY: command output and shell sessions
    shouldn't look identical to source code.
- **New dependency: `rehype-highlight`** (bundles `highlight.js`). Flagged per
  repo rules — it's a remark/rehype markdown plugin, not a second UI kit, so it
  doesn't violate "Tailwind + shadcn only." Kept scoped to `Markdown.jsx`.
- **Roadmap sidebar (`RoadmapLesson.jsx`) is collapsible per module.** Each
  module is a dropdown; only the module containing the active lesson is open by
  default. WHY: a flat list of ~30+ lessons was a wall of options. The green
  "read" tick was removed from the sidebar (day numbers always show) — progress
  ticks cluttered navigation; localStorage read-tracking still exists but is no
  longer surfaced there.
- **Lesson/chapter subheadings recolored** to the indigo accent (`Markdown.jsx`
  h2→indigo-200, h3→indigo-300; `Learn.jsx` chapter-modal headings tinted to
  each chapter's accent) so structure is scannable against serif body text.
- **Learn header stat is a static "76 Articles"** (was a `read/total`
  progress counter). WHY: a marketing/scale signal reads stronger on a landing
  surface than a personal-progress fraction. NOTE: the curriculum defines 76
  lessons but only 31 are ingested in the DB today, so the roadmap block still
  says "Start the 31-lesson roadmap" — the two numbers are intentionally
  different (headline vs. live count); reconcile if that ever confuses.
- **Home page reframed around the platform.** Hero is "Learn. Design.
  Simulate." with a secondary CTA into the Library (replaced "Browse Case
  Studies"). A new structured-path section sits between the company carousel and
  the components showcase, anchored by an original inline-SVG roadmap diagram
  (`components/home/LearnPathDiagram.jsx` — self-contained, no external asset).
  "Who uses SystemSim" and the (now) "Four ways to learn" grid were rewritten to
  include the self-study roadmap as a first-class pillar.

**Light / dark mode — DECISION (2026-07-16):** Satyam asked for full light/dark
theming without breaking the existing palette. `next-themes` was already a
dependency and half-wired (`ThemeProvider` in `main.jsx`, `DottedSurface`
already branching particle color on `theme`) but locked with
`forcedTheme="dark"` — this turns that on rather than building parallel
infrastructure.

- **Mechanism: CSS variables, not `dark:` classnames.** `base/surface/
  elevated/dim/ink/muted` + the new `hairline` token became CSS-var-backed
  colors (see table above) toggled by a `.light` class on `<html>`
  (`darkMode: ["class"]` in `tailwind.config.js`, attribute="class" in
  next-themes). WHY over sprinkling `dark:` variants everywhere: the app
  already used these six semantic tokens consistently on every surface, so
  swapping the variable definitions repainted the entire app with zero
  per-component edits — versus manually pairing a `dark:` override onto every
  `bg-base`/`text-ink`/etc. call site.
- **`white/[alpha]` overlay hack → `hairline`.** ~130 call sites across 20
  files used `border-white/[0.06]`, `hover:bg-white/[0.05]`, etc. as a
  hairline border/hover wash — correct only because the page was always dark.
  Mechanically renamed to `hairline/[alpha]` (same alpha values), backed by a
  var that's white in dark mode and near-ink in light mode. `SplashLoader.jsx`
  was deliberately excluded — its background is a hardcoded dark full-screen
  overlay in both themes (a branded loading screen, not themed UI), so its
  `white/[alpha]` accents are correct as literal white and must stay that way.
- **Status-color text steps needed the same treatment as the accent scale.**
  `indigo-200/300/400` and the equivalent `amber/emerald/sky` `300/400` (plus
  `red-300/400/500`) are the *pastel* steps of each scale, used throughout as
  link/label/warning/healthy/error text (30+ call sites for indigo alone).
  Fine light-on-dark (light mode has been shipping this in dark-only for a
  while); on white they measured 1.4–2.8:1 — a real WCAG-failing "looks
  broken" bug, not a nitpick. CSS-var-backed the same way, swapped to darker
  steps of the same scale in light mode (5–9:1). The rest of each scale
  (500/600/700/800/900/950, used for backgrounds/borders/solid CTAs) was left
  alone — it already reads fine on both themes.
- **One real contrast bug found and fixed, not just theoretical:**
  `ComponentCard.jsx` (the Home page's 14-component showcase tiles) has a
  fixed-dark gradient background in both themes by design (`from-*-900/70`
  gradients, meant to always read as colorful dark chips). Its label used
  theme-reactive `text-ink`, and four of its icon colors reused
  `text-indigo-300`/`text-sky-300`/`text-amber-300`/`text-emerald-300` — the
  exact classes just made theme-reactive above. Both would have gone
  dark-on-dark in light mode. Fixed by hardcoding those specific values
  (`text-white/90` for the label, literal hex for the four icon colors) since
  this tile's background never follows the site theme.
- **Toggle:** `components/ui/ThemeToggle.jsx` (sun/moon icon, `next-themes`'
  `useTheme()` directly — not routed through `uiSlice`; see `frontend/
  CLAUDE.md`), in the Navbar desktop bar and mobile menu.
- **Default stays dark, no OS-following.** `defaultTheme="dark"`,
  `enableSystem={false}` — a first-time visitor sees dark; light is an
  explicit opt-in via the toggle, not a silent repaint when the OS theme
  changes underneath the user.
