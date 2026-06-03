---
title: Stats
description: Metric display card with a prominent icon, value, and optional footer for trend or contextual data.
package: "@g4rcez/components"
export: "{ Stats }"
import: "import { Stats } from '@g4rcez/components/stats'"
category: display
---

# Stats

Metric display card with a prominent icon, value, and optional footer for trend or contextual data.

## Import

```tsx
import { Stats } from "@g4rcez/components/stats";
```

## Props

| Prop            | Type                              | Default | Description                                          |
| --------------- | --------------------------------- | ------- | ---------------------------------------------------- |
| `title`         | `Label`                           | —       | Metric label displayed above the value               |
| `Icon`          | `React.FC<{ className: string }>` | —       | Icon component to display (Phosphor recommended)     |
| `iconContainer` | `string`                          | —       | Additional classes for the icon background container |
| `footer`        | `React.ReactElement`              | —       | Optional footer area for trend data or context       |
| `children`      | `React.ReactNode`                 | —       | The metric value (e.g. a number, formatted string)   |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                     | CSS Variable           | Purpose                             |
| ------------------------- | ---------------------- | ----------------------------------- |
| `bg-card-background`      | `--card-background`    | Card surface                        |
| `border-card-border`      | `--card-border`        | Card border and divider             |
| `rounded-stats-radius`    | `--stats-radius`       | Corner radius                       |
| `shadow-shadow-card`      | `--shadow-card`        | Card drop shadow                    |
| `bg-primary`              | `--primary`            | Icon container background (default) |
| `text-primary-foreground` | `--primary-foreground` | Icon color (default)                |
| `divide-card-border`      | `--card-border`        | Divider between header and footer   |

## Examples

### Basic Metric

```tsx
import { UsersIcon } from "@phosphor-icons/react";

<Stats title="Active Users" Icon={UsersIcon}>
    1,234
</Stats>;
```

### With Footer Trend

```tsx
import { TrendUpIcon, CurrencyDollarIcon } from "@phosphor-icons/react";

<Stats
    title="Revenue"
    Icon={CurrencyDollarIcon}
    iconContainer="bg-success"
    footer={
        <div className="flex items-center gap-1 text-success text-sm font-medium">
            <TrendUpIcon size={14} />
            <span>+12% from last month</span>
        </div>
    }
>
    $45,200.00
</Stats>;
```

### Custom Icon Container Theme

```tsx
import { WarningCircleIcon } from "@phosphor-icons/react";

<Stats title="Error Rate" Icon={WarningCircleIcon} iconContainer="bg-danger">
    0.3%
</Stats>;
```

### Dashboard Grid

```tsx
import { UsersIcon, ClockIcon, TargetIcon } from "@phosphor-icons/react";

<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <Stats title="Users" Icon={UsersIcon}>
        1.2k
    </Stats>
    <Stats title="Sessions" Icon={ClockIcon}>
        450
    </Stats>
    <Stats title="Conversion" Icon={TargetIcon}>
        3.2%
    </Stats>
</div>;
```

### With Skeleton Loading

```tsx
import { ChartBarIcon } from "@phosphor-icons/react";
import { Skeleton } from "@g4rcez/components";

<Stats title="Page Views" Icon={ChartBarIcon}>
    {isLoading ? <Skeleton className="h-9 w-24" /> : "48,301"}
</Stats>;
```

## Do

- Use clear, descriptive icons that relate to the metric shown.
- Keep the metric value prominent and concise — one or two tokens, not a sentence.
- Use `iconContainer` with design-token color classes (`bg-success`, `bg-danger`) to differentiate metric types visually.
- Use the `footer` prop to provide trend context (period-over-period comparison).

## Don't

- Don't pass raw Tailwind color classes (`bg-green-500`, `text-red-600`) to `iconContainer` or `footer` — use design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`) — override CSS variables in your `@theme` block.
- Don't place too many `Stats` cards without logical grouping — they lose impact when overused.
- Don't put long sentences as `title` or `children`; they should be scannable at a glance.

## Accessibility

- The metric label uses an `<h3>` element for proper heading hierarchy within a dashboard context.
- The icon renders via `props.Icon` with a `className` prop applied; Phosphor icons include accessible SVG structure.
- Consider adding `aria-label` to the icon container if the icon carries essential meaning not conveyed by the title.

## Notes

- The icon container is sized via `size-10` with `p-8` padding, producing a square aspect ratio. Use `iconContainer` to adjust (`bg-success`, `bg-danger`, etc.).
- `children` renders in a `<p>` with `text-4xl font-semibold` — pass a pre-formatted string for custom number formatting.
- The footer section only renders when `footer` is provided; otherwise the divider is omitted.
