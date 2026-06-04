# Product

## Register

product

## Users

Software engineers actively preparing for system design interviews. They're time-pressured, technically confident, and outcome-focused: they need to build mental models fast, practice making tradeoffs, and get honest feedback on their designs. They use this tool in focused study sessions, not casual browsing — every minute counts.

## Product Purpose

SystemSim is an interactive distributed-systems learning platform. Users design systems visually on a canvas, simulate load to surface bottlenecks, study real company incident case studies, and take scored challenges against reference architectures. Success means a user walks away from a session with sharper intuition for distributed systems tradeoffs — and more confidence walking into an interview.

## Brand Personality

Clean · Educational · Approachable. The tool should feel like the best professor you ever had: clear, structured, never condescending. It rewards curiosity without punishing mistakes. Think Excalidraw's whiteboard ease crossed with Linear's product discipline.

## Anti-references

Lucidchart and corporate diagramming tools — avoid the bloated enterprise aesthetic: too many panels, too much chrome, too little soul. Also avoid the bare-utility trap (LeetCode-style): no personality, no delight, pure function with no craft behind it.

## Design Principles

1. **The canvas is the hero.** UI chrome should recede. The architecture the user is drawing is front and center; toolbars and panels serve it, not the other way around.
2. **Fast loops build confidence.** Simulate instantly. Surface bottlenecks directly. Let users iterate without friction — every extra click is a missed learning moment.
3. **Opinionated, not overwhelming.** Make strong defaults so users trust the tool. Avoid exposing unnecessary configuration; good defaults should be good enough to learn from.
4. **Clarity over cleverness.** Every label, score, and result should be readable at a glance. If a user has to think about what a result means, the UI failed.
5. **Earn every interaction.** No decorative chrome. Every panel, tooltip, and transition should pay for itself in clarity or delight.

## Accessibility & Inclusion

WCAG 2.1 AA baseline. Keyboard-navigable canvas controls. Bottleneck highlights must not rely on color alone — use icons or labels alongside red/green. Respect `prefers-reduced-motion` for transitions and animations.
