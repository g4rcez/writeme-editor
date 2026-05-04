# Landing Page Rebuild — Design Spec

**Date:** 2026-05-04
**Branch:** g4rcez/rebrand
**File:** `landing-page/index.html` (standalone static HTML, no build step)

---

## Summary

Full rebuild of the Write Me landing page based on the brand manual. Direction: editorial, type-led, restrained. The page replaces the current marquee-heavy layout with a focused structure: hero → concept → features → screenshot → CTA → footer.

Approved mockup: `.superpowers/brainstorm/83884-1777908497/content/fullpage-v2.html`

---

## Typography

- **Headings** (h1–h6, logo, stat numbers): `Plus Jakarta Sans` — variable weight 200–800, italic axis
- **Body / UI** (paragraphs, nav links, buttons, labels, footer): `Manrope` — variable weight 200–800
- **Monospace accents** (kicker, section labels, feature numbers, footer bottom): `JetBrains Mono` — weight 400 and 700

Google Fonts URL:
```
https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=Manrope:wght@200..800&family=JetBrains+Mono:wght@400;700&display=swap
```

---

## Color Tokens

All sourced from the brand manual. Applied as CSS custom properties on `:root`:

- `--bg: #1c0520` — primary background (deep purple-black)
- `--fg: #add9b5` — primary text (sage green, "the new white")
- `--purple: #b799ff` — lavender accent (CTAs, stat numbers, italic text, nav CTA bg)
- `--indigo: #3b3486` — panel/border base color
- `--green: #92e341` — AI/accent green (kicker lines, logo dot, section eyebrows only)
- `--alt-bg: #171717` — screenshot frame background
- `--fg-dim: rgba(173,217,181,0.55)` — secondary text
- `--fg-faint: rgba(173,217,181,0.28)` — tertiary text, labels
- `--border: rgba(59,52,134,0.5)` — dividers, card borders
- `--surface: rgba(59,52,134,0.12)` — subtle surface tint

---

## Page Structure

Seven sections in order. All text is English.

### 1. Nav

- Sticky, `backdrop-filter: blur(20px)`, 60px height
- Left: logo mark (8px green dot with glow) + "Write Me" in Plus Jakarta Sans 700
- Center: 3 links — Features, Privacy, GitHub — Manrope 500, `--fg-dim`
- Right: "Start writing" CTA — Manrope 600, `--purple` background, `--bg` text, 8px radius

### 2. Hero

- Full viewport height minus nav (`calc(100vh - 60px)`), `display: grid; grid-template-columns: 1fr auto; align-items: center`
- **Left column** (`max-width: 620px`):
  - Kicker: JetBrains Mono, `--green`, with 32px horizontal rule before text — "Digital workshop for thought"
  - H1: Plus Jakarta Sans 800, `clamp(56px, 7.5vw, 90px)`, `letter-spacing: -0.04em`, `line-height: 0.95`
    - "Just you / and your / *thoughts.*" — italic line uses weight 300, color `--purple`
  - Subtitle: Manrope 400, 17px, `--fg-dim`, max-width 420px
  - Actions: primary button (`--fg` bg, `--bg` text, 9px radius) + ghost link
- **Right column** (`.hero-right`, `display: flex; align-items: stretch; align-self: stretch`):
  - Vertical rule: 1px, gradient from transparent → `--border` → transparent
  - Stats column: three stats right-aligned — `0 / distractions`, `∞ / focus` (green), `100% / local first`
  - Stat numbers: Plus Jakarta Sans 800, 44px, `--purple`; labels: Manrope 600, 10px uppercase, `--fg-faint`

### 3. Concept

- Two-column grid: `200px 1fr`, `gap: 72px`
- Left: JetBrains Mono eyebrow — "The idea"
- Right: Manrope 400, 22px, single editorial paragraph — brand voice, no bullet lists
  - Copy: "Write Me is a **digital workshop for thought** — not a word processor, not a productivity suite. It's a clean space where *the only thing that matters is the quality of your thinking.* No toolbars fighting for your attention. No cloud syncing your private ideas. Just clarity, speed, and the words you mean to write."

### 4. Features

- Header row: "What's inside" label (Manrope 700 uppercase) + "04 features" (JetBrains Mono, right-aligned)
- 2×2 grid — odd items have right border + right padding, even items have left padding
- Each item: JetBrains Mono number (01–04) + Plus Jakarta Sans 700 title + Manrope 400 description
- Four features:
  1. **True Privacy** — no servers, no trackers, everything local
  2. **Zero Distraction** — minimalist interface, no toolbars
  3. **Pure Markdown** — plain text, portable, future-proof
  4. **AI, Privately** — bring your own model, local only

### 5. Screenshot

- JetBrains Mono eyebrow — "The workspace"
- macOS-style window frame: 40px bar with three colored dots (red/yellow/green), 14px radius, `--alt-bg` background
- `<img src="/screenshot.png">` — `object-fit: cover; object-position: top; height: 420px`
- On image load error: show placeholder with filename in JetBrains Mono

### 6. CTA

- Centered, 120px vertical padding
- Subtle radial glow: `rgba(183,153,255,0.1)` from bottom
- Eyebrow: JetBrains Mono — "Ready?"
- H2: Plus Jakarta Sans 800, `clamp(40px, 5.5vw, 68px)` — "Find your *flow.*" (italic weight 300, `--purple`)
- Subtitle: Manrope 400, 16px, max-width 460px
- Two actions: primary "Start writing →" + outline "★ Star on GitHub"

### 7. Footer

- Three-column grid: `2fr 1fr 1fr`
- Brand column: logo name + one-line description
- Product links: Web App, Desktop (soon), Changelog
- Community links: GitHub, Twitter / X
- Bottom bar: "© 2026 Write Me" left, "Built by g4rcez" right — Manrope 500, `--fg-faint`

---

## What's Removed vs Current Page

- Marquee strip (scrolling features) — dropped, doesn't fit editorial direction
- 6-feature grid — condensed to 4 editorial features
- "Shape the future / donations" CTA block — dropped
- `lucide` CDN script dependency — dropped (no inline icons needed)
- All blue accent colors (`#4682b4`, etc.) — replaced with brand palette

---

## Implementation Notes

- Single static HTML file: `landing-page/index.html`. No build step, no JS framework.
- `<link rel="preconnect">` to both `fonts.googleapis.com` and `fonts.gstatic.com crossorigin` before the stylesheet link — required for variable font performance.
- `screenshot.png` already exists at `landing-page/screenshot.png` — path is `/screenshot.png` relative to the page (served from same directory).
- CSS custom properties on `:root` only — no Tailwind, no PostCSS.
- `-webkit-font-smoothing: antialiased` on body for macOS rendering.
- The logo dot uses `box-shadow: 0 0 8px var(--green)` for the glow effect.
- `backdrop-filter: blur(20px)` on nav — requires `background` with alpha, not solid color.
