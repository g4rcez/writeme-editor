---
name: Write Me
description: "A local-first writing workspace for people who write to think."
colors:
  ink: "hsl(225 20% 6%)"
  warm-silver: "hsl(42 22% 91%)"
  violet-lavender: "hsl(258 100% 80%)"
  action-ink: "hsl(0 0% 9%)"
  violet-hover: "hsl(258 100% 74%)"
  raised-surface: "hsl(225 17% 9%)"
  quiet-surface: "hsl(225 12% 14%)"
  muted-copy: "hsl(42 10% 70%)"
  divider: "hsl(223 10% 19%)"
typography:
  display:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "clamp(3.5rem, 7.1vw, 7rem)"
    fontWeight: 600
    lineHeight: 0.94
    letterSpacing: "-0.04em"
  body:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
rounded:
  panel: "15.84px"
  pill: "9999px"
spacing:
  gutter-mobile: "20px"
  gutter-tablet: "32px"
  gutter-wide: "48px"
  section-compact: "80px"
  section-standard: "112px"
  section-spacious: "144px"
components:
  button-primary:
    backgroundColor: "{colors.violet-lavender}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.violet-hover}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.pill}"
    height: "48px"
  action-outline:
    backgroundColor: "transparent"
    textColor: "{colors.warm-silver}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "48px"
---

# Design System: Write Me

## Overview

**Creative North Star: "The Thought Field"**

Write Me's landing page is an ink-black field for people who write to think. Warm silver keeps the reading voice calm; the product's own lavender-violet marks the action and the thinking space. The first view shows the actual app before the copy asks the visitor to believe anything.

An outlined hex lattice holds the hero together. Its quiet violet lines brighten into one distinct halo when a fine pointer crosses a cell; after the hero, the page opens into ruled lists, generous intervals, and flat tonal sections. The surrounding structure sells the feeling of care without fake proof or clutter.

**Key Characteristics:**
- Near-black ink, warm silver type, and lavender-violet as the single brand signal.
- The real Write Me workspace is the hero's product proof.
- A subtle honeycomb field earns attention through hover, not motion loops.
- Open ruled sections and generous vertical rhythm replace a grid of feature cards.

## Colors

Ink and warm neutrals carry the page; the single purple brand scale leads action and the hive.

### Primary

- **Lavender-violet:** Use the product's purple token for the primary CTA, wordmark accent, emphasized headline phrase, and hive outline/glow.
- **Deeper violet hover:** The primary action darkens slightly on hover while keeping its dark foreground.
- **Action ink:** Near-black text and icon color maintain contrast on the bright purple button.

### Neutral

- **Ink:** Blue-black page canvas and sticky navigation foundation.
- **Warm silver:** Main text and headings.
- **Muted copy:** Secondary descriptions and quiet navigation links.
- **Raised and quiet surfaces:** Subtle separation for the screenshot frame and secondary hover state; keep content sections mostly flat.
- **Divider:** Fine horizontal rules between platform rows and sections.

### Named Rules

**The Signal Rule.** Use Write Me's purple for the action, the highlighted headline, and the hive; green does not replace it as the primary brand color.

## Typography

**Display Font:** IBM Plex Sans (with a sans-serif fallback).
**Body Font:** IBM Plex Sans (with a sans-serif fallback).
**Label/Mono Font:** JetBrains Mono (with a monospace fallback).

**Character:** A clean, contemporary sans keeps the page direct and legible; mono labels add a restrained technical note without changing the writing-first voice.

### Hierarchy

- **Display:** 600 weight, fluid `clamp(3.5rem, 7.1vw, 7rem)`, 0.94 line-height, `-0.04em` tracking.
- **Headline:** 600 weight, 36px below 640px, 48px from 640px, and 60px from 1024px; 1.02 line-height.
- **Body:** 400 weight, 16px/28px by default and 18px/32px on wide layouts; keep paragraphs to a readable measure.
- **Label:** 400 weight, 12px in JetBrains Mono; subdued and used sparingly.
- **Actions and navigation:** 500–600 weight, 14px.

## Layout

- Use a centered content frame capped at 88rem, with 20px mobile, 32px tablet, and 48px wide gutters.
- Keep the sticky top navigation 72px tall. The hero fills the remaining viewport height on desktop and stacks into a readable single column on narrow screens.
- At 1024px and above, the hero gives the copy a narrower column and the real app capture a wider one; below that breakpoint, stack the screenshot below the message.
- Use 80px compact, 112px standard, and 144px spacious vertical section intervals. Content sections stay open, with hairline dividers rather than repeated card grids.
- Platform download rows pair concise platform details with clear actions, use 28px vertical padding (32px from 640px), and reflow into a single column on small screens.

## Elevation & Depth

- Keep the page and most sections flat against the ink canvas. Use a slightly raised surface only for the product screenshot frame and a quiet surface for secondary interaction.
- The screenshot frame gets one diffuse violet shadow; avoid stacking multiple hard shadows.
- The hive's 72px cells use a low-contrast violet outline at rest. Fine-pointer hover raises one cell into a distinct purple halo and brighter interior; the base state remains visible.

### Named Rules

**The One Bloom Rule.** Keep resting cell outlines quiet and reserve the pronounced violet bloom for the hovered cell. Respect reduced-motion preferences and do not run ambient animation loops.

## Shapes

- Pill-shaped actions use the full rounded radius; the product screenshot frame uses a 15.84px radius.
- Keep dividers square and fine. The hexagonal hive is the only repeating decorative geometry.
- Preserve the open, editorial surface treatment; avoid turning each feature into a rounded card.

## Components

### Buttons

- Primary actions are 48px tall, pill-shaped, lavender-violet with near-black text. They deepen slightly on hover and show a clear purple focus ring.
- Secondary actions use a transparent background, warm-silver text, a fine divider border, and a quiet-surface hover.
- The compact navigation CTA is 40px tall while retaining the primary action colors.

### Product Screenshot Frame

- Show the real `public/writeme-home-hero.png` capture without recoloring the app UI.
- Use the raised surface, 15.84px corner radius, and a single soft violet shadow; do not add mock window chrome.

### Navigation

- Keep the wordmark at left, text links centered/right on desktop, and the primary CTA at right. Use a 72px sticky bar with a translucent ink surface and backdrop blur.
- Hide the text links below 640px while keeping the brand mark and primary action visible.

### Platform Downloads

- Give each platform row a recognizable OS mark in Write Me purple beside its name and compatibility detail. Keep the list open and divider-led, with download actions aligned alongside at wide sizes.
- Preserve the responsive Linux layout when a platform offers more than one download format.

### Hive Field

- Use an evenly spaced hex lattice behind the hero content, with low-contrast purple edges at rest.
- On fine-pointer hover, transition the cell's outline/interior and add a diffuse purple drop-shadow. Disable motion under reduced-motion preferences.
- Mark the decorative grid as hidden from assistive technology; the product message and controls remain the accessible content.

## Do's and Don'ts

### Do

- Do place the brand purple on the primary CTA, the phrase accent, and the hive glow.
- Do keep the lavender lattice low-contrast until a fine-pointer hover.
- Do let thin dividers, generous spacing, and the real editor screen carry the supporting story.

### Don't

- Don't replace the brand's purple with green as the primary action or hive hue.
- Don't use raw Tailwind palette classes; consume semantic theme tokens.
- Don't let the idle hive lines obscure the copy or real product screenshot.
