---
title: Heading
description: A minimal heading wrapper that renders as h2 by default, delegating to Polymorph for element flexibility.
package: "@g4rcez/components"
export: "{ Heading }"
import: "import { Heading } from '@g4rcez/components'"
category: core
---

# Heading

A minimal heading wrapper that renders as `h2` by default. It delegates to `Polymorph` internally, so all children are forwarded without additional styling or tokens.

## Import

```tsx
import { Heading } from "@g4rcez/components";
```

## Props

| Prop       | Type              | Default | Description                |
| ---------- | ----------------- | ------- | -------------------------- |
| `children` | `React.ReactNode` | -       | The content of the heading |

## Design Tokens

None — `Heading` itself applies no styles. Style via `className` passed to the component or global heading rules in your theme.

## Examples

### Default Usage

```tsx
<Heading>Section Title</Heading>
```

### Custom Heading Level

The current implementation always renders as `h2`. Use the `Polymorph` component directly if you need a different heading level.

```tsx
import { Polymorph } from "@g4rcez/components";

<Polymorph as="h1" className="text-3xl font-bold tracking-tight text-foreground">
  Page Title
</Polymorph>

<Polymorph as="h3" className="text-lg font-semibold text-foreground">
  Subsection Title
</Polymorph>
```

### Applying Typography Styles

```tsx
<Heading className="text-2xl font-bold text-foreground">Dashboard Overview</Heading>
```

## Do

- Use `Heading` for `h2`-level section titles throughout your app to ensure a consistent element
- Use design-token classes for color (`text-foreground`, `text-muted-foreground`) — never raw color utilities
- Pair with `PageHeader` or `PageTitle` from the Typography components for full page structure

## Don't

- Don't pass raw Tailwind color classes (`text-gray-900`, `text-black`) — use `text-foreground` instead
- Don't use arbitrary Tailwind values (`text-[#333]`) — override CSS variables in your `@theme` block
- Don't skip heading hierarchy — if you need `h1` or `h3`, use `Polymorph as="h1"` rather than misusing `Heading`
- Don't use `Heading` for non-heading content purely for visual sizing

## Accessibility

- Renders as `<h2>` by default, providing semantic structure for screen readers and document outline tools
- Pass `className` for visual styling without altering the semantic element
- Ensure each page has a single `h1` (use `Polymorph as="h1"`) before using `Heading` (`h2`) for section titles

## Data Attributes

- `data-component="polymorph"`: Inherited from the underlying `Polymorph` component

## Notes

- `Heading` is a thin wrapper — it accepts `children` only; all other styling is done via `className`
- If you need an `as` prop for dynamic heading levels, use `Polymorph` directly
