---
name: writeme
description: An AI-native markdown editor and knowledge tool for builders who think by writing.
colors:
    primary: "#B899FF"
    primary-hover: "#9B77F5"
    primary-surface: "#F0EAFF"
    foreground: "#323843"
    foreground-muted: "#717178"
    background: "#FFFFFF"
    surface: "#F4F4F5"
    surface-raised: "#FFFFFF"
    border: "#E4E4E8"
    danger: "#F16161"
    warn: "#F59E0B"
    success: "#22C55E"
    info: "#0EA5E9"
    background-dark: "#111117"
    surface-dark: "#10131B"
    border-dark: "#27272C"
    foreground-dark: "#F4F4F5"
    foreground-muted-dark: "#A1A1AA"
typography:
    body:
        fontFamily: "'IBM Plex Sans', sans-serif"
        fontSize: "16px"
        fontWeight: 400
        lineHeight: 1.5
        letterSpacing: "normal"
        fontFeature: "'cv01', 'cv02', 'cv03', 'cv04', 'ss01'"
    headline:
        fontFamily: "'IBM Plex Sans', sans-serif"
        fontSize: "18px"
        fontWeight: 700
        lineHeight: 1.4
        letterSpacing: "normal"
    title:
        fontFamily: "'IBM Plex Sans', sans-serif"
        fontSize: "14px"
        fontWeight: 600
        lineHeight: 1.4
        letterSpacing: "normal"
    label:
        fontFamily: "'IBM Plex Sans', sans-serif"
        fontSize: "12px"
        fontWeight: 500
        lineHeight: 1.0
        letterSpacing: "0.04em"
    mono:
        fontFamily: "'JetBrains Mono Variable', monospace"
        fontSize: "14px"
        fontWeight: 400
        lineHeight: 1.5
        letterSpacing: "normal"
        fontFeature: "common-ligatures"
rounded:
    button: "0.55rem"
    card: "0.75rem"
    pill: "2rem"
spacing:
    base: "1rem"
    input-height: "2.5rem"
    field-label: "0.875rem"
    sm: "0.75rem"
    lg: "1.125rem"
components:
    button-primary:
        backgroundColor: "{colors.primary}"
        textColor: "#FFFFFF"
        rounded: "{rounded.button}"
        padding: "6px 16px"
    button-primary-hover:
        backgroundColor: "{colors.primary-hover}"
        textColor: "#FFFFFF"
        rounded: "{rounded.button}"
        padding: "6px 16px"
    button-secondary:
        backgroundColor: "{colors.surface}"
        textColor: "{colors.foreground}"
        rounded: "{rounded.button}"
        padding: "6px 16px"
    button-ghost:
        backgroundColor: "transparent"
        textColor: "{colors.foreground-muted}"
        rounded: "{rounded.button}"
        padding: "6px 16px"
    nav-item-active:
        backgroundColor: "{colors.primary-surface}"
        textColor: "{colors.primary}"
        rounded: "{rounded.button}"
        padding: "6px 8px"
    nav-item-inactive:
        backgroundColor: "transparent"
        textColor: "{colors.foreground-muted}"
        rounded: "{rounded.button}"
        padding: "6px 8px"
    tab-active:
        backgroundColor: "{colors.surface}"
        textColor: "{colors.foreground}"
        height: "36px"
        padding: "0 10px"
    tab-inactive:
        backgroundColor: "transparent"
        textColor: "{colors.foreground-muted}"
        height: "36px"
        padding: "0 10px"
---

# Design System: writeme

## 1. Overview

**Creative North Star: "The Patient Workshop"**

writeme is the tool you return to every day. Not because it demands your attention, but because it never gets in the way. The visual language is built around reliability and restraint: a surface that stays calm whether you are capturing a half-formed idea at 7am or tracing a research thread at midnight. The primary violet accent is present, trustworthy, and quiet. It marks what matters without announcing it.

The system operates in two modes that share one vocabulary. Light mode is a clean workspace: near-white surfaces, dark foreground text, a border language that divides without interrupting. Dark mode is the same workshop after the overhead lights go down: deep charcoal surfaces, the same structural hierarchy, the same violet accent. Neither mode is primary. The user chooses; the design honors that choice identically.

IBM Plex Sans carries everything: headings, labels, UI copy, running text. It is humanist, precise, and slightly warm without being decorative. JetBrains Mono handles code. The pairing needs no ornamentation.

**This system explicitly rejects:**

- Dev tool brutalism: monospace everything, flat gray, no warmth. writeme is for builders, not for signaling that you are a builder.
- AI startup aesthetic: gradient blobs, glassmorphism panels, purple-to-teal gradients. The violet here is a tool color, not a pitch deck.
- Sparse blog templates: writeme has serious information density. Empty breathing room is for moments, not default states.

**Key Characteristics:**

- Single accent color used for primary actions, active states, and semantic emphasis only.
- IBM Plex Sans throughout, no display font pairing.
- Nearly flat elevation: shadows are ambient and barely perceptible.
- Dynamic font sizing via `--default-size` CSS variable (default 16px); all spacing scales from it.
- Full multi-theme support: light, dark, Catppuccin Mocha, Tokyo Night. Same structural vocabulary in all.

## 2. Colors: The Quiet Violet Palette

A restrained palette with one warm-violet accent. The accent is used for primary interactive states only; everything else is neutral and structural.

### Primary

- **Quiet Violet** (#B899FF): The single accent color. Used for primary buttons, active navigation indicators, hashtag decorations, links, and selection states. A soft lavender-purple that is distinctive without being aggressive. The canonical system value is an HSL CSS custom property (`hsla(var(--primary-DEFAULT))`); #B899FF is the resolved sRGB approximation.
- **Violet Hover** (#9B77F5): The pressed/hover state of the primary. Slightly deeper, same hue family.
- **Violet Surface** (#F0EAFF): The 10% tint of the primary used for active nav item backgrounds and selection surfaces. Never used on full-surface areas.

### Neutral

- **Ink** (#323843): Primary foreground for body text and headings (light mode). Dark blue-gray with a slight cool cast.
- **Slate** (#717178): Muted foreground for secondary text, placeholders, inactive labels.
- **Bone** (#F4F4F5): Surface/muted background. Used for sidebar panels, code blocks, hover states on nav items.
- **Ghost** (#E4E4E8): Border and divider color (light mode). Barely perceptible; divides without interrupting.
- **Canvas** (#FFFFFF): Base background of the content area (light mode).

### Dark Mode Variants

- **Deep Charcoal** (#111117): Base background (dark mode). Deep but not black; a subtle blue-black cast.
- **Night Surface** (#10131B): Card and panel backgrounds (dark mode). Slightly cooler and lighter than the base.
- **Coal** (#27272C): Border color (dark mode). Same structural role as Ghost.
- **Pale** (#F4F4F5): Primary foreground (dark mode). Near-white with a neutral cast.

### Semantic

- **Alert Red** (#F16161): Danger/error states only.
- **Amber** (#F59E0B): Warning states.
- **Leaf** (#22C55E): Success states.
- **Sky** (#0EA5E9): Info/informational states.

### Named Rules

**The One Voice Rule.** Quiet Violet appears in ≤10% of any given screen surface. It marks the active state, the primary action, the current selection. Its rarity is the point. When everything is purple, nothing is.

**The Semantic-Only Rule.** Alert Red, Amber, Leaf, and Sky are reserved for their semantic states. They are never used decoratively or for section headers.

## 3. Typography

**Body Font:** IBM Plex Sans (with `sans-serif` fallback)**Code Font:** JetBrains Mono Variable (with `monospace` fallback)

**Character:** IBM Plex Sans is humanist with a technical precision that suits a knowledge tool. It reads well in long prose, holds up in dense UI labels, and never looks decorative. JetBrains Mono adds ligature support and optical sizing. The pairing is intentionally minimal: one sans, one mono, no display family.

All sizes scale from `--default-size` (default 16px), which the user can adjust. All spacing scales from the same root.

### Hierarchy

- **Headline** (700 weight, 18px / 1.4): Section titles in settings, sidebar headers, dialog titles.
- **Title** (600 weight, 14px / 1.4): Sub-section labels, panel titles, nav section headers. Uppercase tracking (0.04em letter-spacing) reserved for metadata labels only.
- **Body** (400 weight, 16px / 1.5): Editor prose, note content. Max line length: 70ch (enforced via `max-w-safe`). Font features: `cv01, cv02, cv03, cv04, ss01` for optical improvements.
- **Label** (500 weight, 12px / 1.0, tracking 0.04em): Tab labels, activity icon tooltips, metadata chips, keyboard shortcut hints.
- **Mono** (400 weight, 14px / 1.5): All code, inline code spans, terminal output, frontmatter blocks.

### Named Rules

**The Single-Family Rule.** IBM Plex Sans carries headings, UI, and body. No display family is added. Hierarchy is expressed through weight (400/500/600/700) and size, not through font switching.

**The Scale-Root Rule.** Every size and spacing value derives from `--default-size`. Do not introduce hard-coded pixel values that break user-adjustable font sizing.

## 4. Elevation

writeme uses nearly flat elevation. Surfaces are separated by color difference and border opacity, not by shadow depth. This matches the "Patient Workshop" north star: a calm space where surfaces hold still.

### Shadow Vocabulary

- **Ambient Low** (`0 2px 8px -2px rgba(0, 0, 0, 0.06)`): Hover lift on interactive cards and draggable elements only. Present as subtle grounding, not drama.
- **Ambient Medium** (`0 4px 16px -4px rgba(0, 0, 0, 0.10)`): Floating panels, popovers, command palette.
- **Ambient Large** (`0 4px 12px -3px rgba(0, 0, 0, 0.08)`): Modals and dialogs. Still restrained; the overlay handles the sense of depth.
- **Notification** (`1px 2px 2px 2px rgba(33, 54, 68, 0.15)`): Toast and notification cards.

### Named Rules

**The Flat-By-Default Rule.** Shadows appear only in response to state (hover, floating, modal). Resting surfaces are flat. A shadow that is always visible is a border that failed to commit.

**The Backdrop Rule.** `backdrop-blur-sm` is used on the sidebar panel to create tonal separation from the editor surface. This is purposeful (depth signal, not decoration) and is the only use of blur in the system. Blur on cards or popovers is banned.

## 5. Components

### Buttons

Clear feedback; decisive press states. Buttons acknowledge every action.

- **Shape:** Gently curved (0.55rem, \~9px). Not pill, not sharp.
- **Primary:** Quiet Violet (#B899FF) background, white text, 6px/16px padding. Hover: Violet Hover (#9B77F5). Focus: 1px violet outline, 1px offset.
- **Secondary:** Bone (#F4F4F5) background, Ink (#323843) text. Same shape and padding.
- **Ghost:** Transparent background, Slate (#717178) text. For toolbar and activity bar icon actions. Hover: Bone background.
- **Danger variant:** Alert Red background, white text. Used only for destructive confirmation actions.

### Activity Bar

The leftmost 40px strip of the app shell. Icon-only navigation.

- **Width:** 40px fixed.
- **Icons:** 18px Phosphor icons, 1.5px stroke weight.
- **Active:** Quiet Violet text color + 2px violet left-edge indicator (absolute-positioned, 32px tall). Background remains neutral.
- **Inactive:** Foreground at 50% opacity. Hover: full foreground opacity.
- **Bottom cluster:** Sidebar toggle and settings — same treatment, always at the bottom.

### Sidebar Panel

The resizable content panel (150px–600px) to the right of the activity bar.

- **Background:** Bone (#F4F4F5) with `backdrop-blur-sm` in light; Night Surface (#10131B) in dark.
- **Nav items:** Full-width, 8px vertical padding, 8px horizontal. Active: Violet Surface background + Quiet Violet text. Inactive: transparent + Slate text.
- **Section headers:** 12px uppercase label, Slate at 35% opacity, 16px top margin.
- **Resize handle:** 4px wide, transparent at rest. On hover: primary at 50% opacity.

### Tabs Bar

The horizontal tab strip above the editor, 36px tall.

- **Active tab:** Bone/Muted background, full foreground text, 1px violet bottom underline.
- **Inactive tab:** Transparent, foreground at 50% opacity. Hover: foreground at 80%.
- **Close button:** Hidden at rest; visible on tab hover (opacity transition). 10px icon.
- **Rename inline:** `<input>` overlays the label in-place. No modal.

### Editor Surface

The core writing area.

- **Max width:** 70vw (`max-w-safe`). Centered in the content panel.
- **Vertical padding:** 32px top/bottom.
- **Font:** IBM Plex Sans 16px (body). Headings: same family, weight 700.
- **Line length:** Capped at 70ch by max-width constraint. Readers do not scroll horizontally.

### Inputs / Fields

- **Style:** No border at rest (inputs use `border: transparent`). Focus-visible: no custom outline by default (relies on browser default suppressed; see focus handling).
- **Height:** 40px (`--spacing-input-height: 2.5rem`).
- **Placeholder:** Slate (#717178).
- **Error state:** Alert Red border + subtle red background tint.

### Terminal Panel

A collapsible bottom panel.

- **Background:** Hard `#1e1e1e` (dark always, regardless of theme). This is intentional: terminal sessions are always dark.
- **Header:** 12px uppercase label, Slate foreground, tiny 24px height. Matches VS Code conventions users recognize.
- **Resize separator:** 4px, border color at 20% opacity. Hover: primary at 50%.

## 6. Do's and Don'ts

### Do:

- **Do** use Quiet Violet (#B899FF) exclusively for interactive primary states, active navigation, and semantic emphasis. Never for decorative color fills or section headers.
- **Do** derive every size and spacing value from `--default-size`. Hard-coded pixel values that ignore this variable break user-configured font sizing.
- **Do** keep resting surfaces flat. Add shadow only when an element has been lifted by state (hover, floating, modal).
- **Do** use IBM Plex Sans for all UI text including headings. Do not introduce a display or serif family.
- **Do** keep the activity bar at 40px and icon-only. Tooltips (right-placement) are the label surface.
- **Do** support `prefers-reduced-motion` for every animation in the product. Transitions are state signals, not choreography.
- **Do** use semantic color tokens for all state: `danger` for errors, `warn` for warnings, `success` for confirmations. Never use the primary violet for semantic states.

### Don't:

- **Don't** add gradient fills, glassmorphism cards, or purple-to-teal gradients. writeme is a knowledge tool, not a pitch deck. If it looks like an AI startup landing page, it's wrong.
- **Don't** use `backdrop-blur` anywhere except the sidebar panel. That is the single sanctioned use; it earns depth separation. Blur on cards, tooltips, or modals is decorative and banned.
- **Don't** produce dev tool brutalism: monospace-everything, gray-on-gray, no visual warmth. writeme respects the user's craft without cosplaying as a terminal.
- **Don't** create sparse, empty designs that feel like a blog theme. Users have dense information needs. Empty states should teach; white space should breathe at rest, not dominate.
- **Don't** use `border-left` greater than 1px as a colored stripe on cards, list items, callouts, or alerts. Use full borders, background tints, or leading icons instead.
- **Don't** use gradient text (`background-clip: text`). Emphasis is expressed through weight or size.
- **Don't** use `any` hardcoded color that is not a design token reference or CSS custom property. The multi-theme system only works if every color value is token-sourced.
- **Don't** animate CSS layout properties (width, height, padding, margin). Animate `opacity` and `transform` only.
