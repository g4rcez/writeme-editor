---
title: Slider
description: Accessible range input for selecting one or more numeric values along a scale.
package: "@g4rcez/components"
export: "{ Slider }"
import: "import { Slider } from '@g4rcez/components'"
category: form
---

# Slider

Accessible range input for selecting one or more numeric values along a scale.

## Import

```tsx
import { Slider } from "@g4rcez/components";
```

## Props

`Slider` accepts all props from `@base-ui/react/slider` Root, plus:

| Prop           | Type       | Default | Description                                                            |
| -------------- | ---------- | ------- | ---------------------------------------------------------------------- |
| `tooltip`      | `boolean`  | `false` | Shows a tooltip with the current value above the thumb while dragging. |
| `value`        | `number[]` | —       | Controlled value(s).                                                   |
| `defaultValue` | `number[]` | `[0]`   | Initial value(s) for uncontrolled usage.                               |
| `min`          | `number`   | `0`     | Minimum value.                                                         |
| `max`          | `number`   | `100`   | Maximum value.                                                         |
| `step`         | `number`   | `1`     | Increment between selectable values.                                   |
| `className`    | `string`   | —       | Additional classes applied to the control track wrapper.               |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                       | CSS Variable     | Purpose                           |
| --------------------------- | ---------------- | --------------------------------- |
| `bg-background`             | `--background`   | Track background (unfilled area)  |
| `bg-primary`                | `--primary`      | Indicator fill (filled area)      |
| `border-input-border`       | `--input-border` | Thumb border color                |
| `bg-input-switch`           | `--input-switch` | Thumb fill color (checked/active) |
| `focus-within:ring-primary` | `--primary`      | Focus ring on thumb               |

## Variants

### Single thumb

One value in `defaultValue` renders a single draggable thumb.

### Range (dual thumb)

Two values in `defaultValue` render two thumbs that define a range.

## Examples

### Single value

```tsx
import { Slider } from "@g4rcez/components";

export default function VolumeControl() {
    return <Slider min={0} max={100} defaultValue={[50]} onChange={(value) => console.log(value)} />;
}
```

### Range slider

```tsx
import { Slider } from "@g4rcez/components";

export default function PriceRangeFilter() {
    return <Slider min={0} max={1000} defaultValue={[200, 800]} tooltip />;
}
```

### Controlled with tooltip and custom step

```tsx
import { useState } from "react";
import { Slider } from "@g4rcez/components";

export default function SteppedSlider() {
    const [value, setValue] = useState([0.5]);

    return (
        <div className="flex flex-col gap-base">
            <Slider min={0} max={1} step={0.1} value={value} tooltip onValueChange={setValue} />
            <span className="text-sm text-muted-foreground">Current: {value[0].toFixed(1)}</span>
        </div>
    );
}
```

## Do

- Provide visible labels or descriptive context indicating what the slider controls.
- Use `tooltip` for precise numeric adjustments where the exact value matters.
- Use `step` to restrict selection to valid increments (e.g., `step={10}` for percentages in tens).
- Use design-token classes for any wrapper elements (`bg-background`, `text-foreground`).

## Don't

- Don't use `Slider` for very large or effectively infinite ranges where a text `Input` would be more efficient.
- Don't use `Slider` for selecting from a small discrete set (e.g., 3 named options) — use `Radiobox` or `Select`.
- Don't pass raw Tailwind color classes (`bg-blue-500`, `border-gray-300`) — use design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`) — override CSS variables in your `@theme` block instead.

## Accessibility

- Fully accessible via keyboard: Arrow keys increment/decrement the focused thumb.
- Each thumb exposes `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.
- Touch targets for thumbs are sized generously (`size-5`) for mobile usability.
- Compatible with screen readers through the underlying `@base-ui/react/slider`.

## Notes

- Built on `@base-ui/react/slider` — most structural ARIA and keyboard behavior comes from that primitive.
- The `Thumb` sub-component observes `aria-valuenow` mutations via a `MutationObserver` to keep the tooltip value in sync without additional state.
- Locale-aware: the `useLocale` hook is used internally for number formatting in tooltips.
