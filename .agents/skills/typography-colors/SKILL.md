---
name: typography-colors
description: Use when styling editor content elements — paragraphs, headings/titles, callout blocks, hashtag mentions, or links — especially when choosing text, background, or border colors for those elements inside the Tiptap editor. Trigger on any color decision for editor-rendered prose content.
---

# Typography Colors

## Overview

`typography.*` is a semantic Tailwind color namespace that provides typed aliases over raw `@g4rcez/components` design tokens for five editor element types. It exists so editor content styling uses consistent, semantically meaningful class names instead of raw palette values.

## When to Use

**Use for:** Any color applied to editor-rendered content elements:
- Body text / prose → `paragraph`
- Headings, prominent labels → `title`
- Callout blocks → `callout`
- Inline hashtag decorations → `hashtag`
- Hyperlinks → `link`

**Do NOT use for:** UI chrome — toolbars, sidebars, menus, buttons, settings panels. Those should use `@g4rcez/components` tokens directly (`text-foreground`, `bg-primary`, etc.).

## Token Table

| Element | Resolved Token | Use Case |
|---------|---------------|----------|
| `paragraph` | `foreground` | Body text, default prose |
| `title` | `emphasis.DEFAULT` | Headings, prominent labels |
| `callout` | `secondary.DEFAULT` | Callout blocks |
| `hashtag` | `primary.DEFAULT` | Inline hashtag tags |
| `link` | `primary.DEFAULT` | Hyperlinks |

Each element supports five states:

| State | Suffix | Example |
|-------|--------|---------|
| Default | *(none)* | `text-typography-paragraph` |
| Danger | `-danger` | `text-typography-callout-danger` |
| Warning | `-warn` | `bg-typography-callout-warn` |
| Info | `-info` | `border-typography-link-info` |
| Success | `-success` | `text-typography-hashtag-success` |

## Class Pattern

```
{utility}-typography-{element}
{utility}-typography-{element}-{state}
```

Where `{utility}` is any Tailwind color utility: `text`, `bg`, `border`, `ring`, `decoration`, `shadow`, etc.

```tsx
// Default state
<p className="text-typography-paragraph">Body text</p>
<h2 className="text-typography-title">Heading</h2>
<div className="bg-typography-callout border-typography-callout">Callout</div>
<span className="text-typography-hashtag">#tag</span>
<a className="text-typography-link decoration-typography-link">Link</a>

// Semantic states
<div className="bg-typography-callout-warn text-typography-callout-warn">Warning callout</div>
<span className="text-typography-hashtag-danger">Error tag</span>
<a className="text-typography-link-info">Info link</a>
```

## Opacity Modifier

Tailwind opacity modifiers (`text-typography-link/50`) do **NOT** work with these colors — the values are CSS variable references (`hsla(var(--...))`) which are incompatible with Tailwind's opacity modifier mechanism.

## Anti-Patterns

```tsx
// ❌ Raw tokens for editor content
<p className="text-foreground">...</p>
<a className="text-primary">...</a>
<h2 className="text-emphasis">...</h2>

// ✅ Typed typography namespace
<p className="text-typography-paragraph">...</p>
<a className="text-typography-link">...</a>
<h2 className="text-typography-title">...</h2>
```

Using raw tokens (`text-foreground`, `text-primary`) for editor content bypasses the semantic layer and makes future theming or state-specific adjustments harder to apply consistently.
