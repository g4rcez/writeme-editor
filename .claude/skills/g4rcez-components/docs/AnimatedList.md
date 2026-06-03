---
title: AnimatedList
description: Animated list that expands each item into a floating detail overlay on click.
package: "@g4rcez/components"
export: "{ AnimatedList, AnimatedListItem }"
import: "import { AnimatedList, AnimatedListItem } from '@g4rcez/components'"
category: display
---

# AnimatedList

Animated list that expands each item into a floating detail overlay on click.

## Import

```tsx
import { AnimatedList, AnimatedListItem } from "@g4rcez/components";
```

## Props

### AnimatedList

| Prop       | Type              | Default | Description                              |
| ---------- | ----------------- | ------- | ---------------------------------------- |
| `children` | `React.ReactNode` | —       | One or more `AnimatedListItem` elements. |

### AnimatedListItem

| Prop          | Type                             | Default | Description                                                                                                                                 |
| ------------- | -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`       | `Label`                          | —       | Primary heading shown in the list row and the overlay header.                                                                               |
| `description` | `Label`                          | —       | Secondary text shown below the title in both the row and overlay header.                                                                    |
| `children`    | `Label`                          | —       | Content rendered inside the expanded overlay below the header.                                                                              |
| `avatar`      | `Label`                          | —       | Optional node (icon, image, or element) shown at the leading edge of the row.                                                               |
| `leading`     | `React.FC<{ open: () => void }>` | —       | Optional render-prop component placed at the trailing edge of the row. Receives an `open` function to trigger the overlay programmatically. |

`Label` is `string | number | ReactNode`.

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                 | CSS Variable         | Purpose                                     |
| --------------------- | -------------------- | ------------------------------------------- |
| `border-card-border`  | `--card-border`      | Row separator border and overlay border     |
| `bg-card-background`  | `--card-background`  | Overlay card background                     |
| `rounded-card-radius` | `--card-radius`      | Overlay card border radius                  |
| `shadow-shadow-card`  | `--shadow-card`      | Overlay card drop shadow                    |
| `text-foreground`     | `--foreground`       | Default row and overlay text color          |
| `text-secondary`      | `--secondary`        | Description text color in rows and overlay  |
| `text-primary`        | `--primary`          | Row title hover color                       |
| `text-danger`         | `--danger`           | Close button hover color                    |
| `bg-floating-overlay` | `--floating-overlay` | Overlay backdrop tint (used at 70% opacity) |
| `z-floating`          | `--z-floating`       | `z-index` for the overlay (value: 22)       |
| `z-overlay`           | `--z-overlay`        | `z-index` for the backdrop scrim            |

## Examples

### Basic list

```tsx
import { AnimatedList, AnimatedListItem } from "@g4rcez/components";

const items = [
    { id: "1", name: "Alice Johnson", role: "Engineering" },
    { id: "2", name: "Bob Smith", role: "Design" },
];

export function TeamList() {
    return (
        <AnimatedList>
            {items.map((member) => (
                <AnimatedListItem key={member.id} title={member.name} description={member.role}>
                    <p className="text-foreground">Full profile details for {member.name}.</p>
                </AnimatedListItem>
            ))}
        </AnimatedList>
    );
}
```

### With avatar

```tsx
import { AnimatedList, AnimatedListItem } from "@g4rcez/components";
import { UserCircleIcon } from "@phosphor-icons/react";

export function UserDirectory() {
    return (
        <AnimatedList>
            <AnimatedListItem
                title="Carol White"
                description="Product Manager"
                avatar={<UserCircleIcon size={40} className="text-muted-foreground" />}
            >
                <div className="flex flex-col gap-2 text-foreground">
                    <p>Department: Product</p>
                    <p>Location: San Francisco</p>
                </div>
            </AnimatedListItem>
        </AnimatedList>
    );
}
```

### With trailing action using `leading`

```tsx
import { AnimatedList, AnimatedListItem } from "@g4rcez/components";
import { Button } from "@g4rcez/components/button";

export function OrderList({ orders }: { orders: Order[] }) {
    return (
        <AnimatedList>
            {orders.map((order) => (
                <AnimatedListItem
                    key={order.id}
                    title={`Order #${order.id}`}
                    description={`Total: ${order.total}`}
                    leading={({ open }) => (
                        <Button size="small" theme="ghost-muted" onClick={open}>
                            View details
                        </Button>
                    )}
                >
                    <OrderDetailContent order={order} />
                </AnimatedListItem>
            ))}
        </AnimatedList>
    );
}
```

### Activity feed

```tsx
import { AnimatedList, AnimatedListItem } from "@g4rcez/components";
import { BellIcon, CheckCircleIcon, WarningIcon } from "@phosphor-icons/react";

const activities = [
    {
        id: "a1",
        icon: <CheckCircleIcon size={20} className="text-success" />,
        title: "Deployment succeeded",
        description: "2 minutes ago",
        detail: "All 3 services started.",
    },
    {
        id: "a2",
        icon: <WarningIcon size={20} className="text-warn" />,
        title: "High memory usage",
        description: "15 minutes ago",
        detail: "Instance i-0ab2c was at 91%.",
    },
];

export function ActivityFeed() {
    return (
        <AnimatedList>
            {activities.map((a) => (
                <AnimatedListItem key={a.id} title={a.title} description={a.description} avatar={a.icon}>
                    <p className="text-sm text-muted-foreground">{a.detail}</p>
                </AnimatedListItem>
            ))}
        </AnimatedList>
    );
}
```

## Do

- Keep `title` and `description` concise — they share one row and truncation is not automatic.
- Provide meaningful `children` content in the overlay; it should justify opening the detail view.
- Use `leading` to surface a primary call-to-action without forcing the user to click the title.
- Use design-token classes for any content inside the overlay (`bg-card-background`, `text-foreground`, `border-card-border`).

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`, `border-gray-300`) — use design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `bg-[--my-var]`) — override CSS variables in your `@theme` block instead.
- Don't use `AnimatedList` for purely informational lists with no actionable detail — use a plain `<ul>` or the `List` component instead.
- Don't embed full sub-applications inside the overlay `children`; keep the detail view focused and lightweight.
- Don't rely on `AnimatedListItem` rendering its `children` directly — it renders nothing on its own; all rendering is managed by the parent `AnimatedList`.

## Accessibility

- The list renders as a semantic `<ul role="list">`.
- Each item's title/description area is a `<button>` that triggers the overlay, making it keyboard accessible.
- The overlay uses `FloatingFocusManager` to trap focus and `FloatingOverlay` with `lockScroll` to prevent background interaction.
- Pressing `Escape` or clicking outside the overlay dismisses it.
- The close button inside the overlay is a focusable `<button>` element.
- `MotionConfig reducedMotion="user"` respects the user's system-level reduced-motion preference.

## Data Attributes

- `data-component="collapse"` — internal animation wrapper (referenced in motion layout animations).
- `layoutId="item-{id}"` — shared between the list row and the overlay card to drive the expand/collapse shared-element animation.
- `layoutId="toast-{id}"` — inner content wrapper used for coordinated layout transitions.

## Notes

- Animations use `motion/react` shared layout (`layoutId`) so the item smoothly expands from its row position into the centered overlay.
- The overlay is rendered in a `FloatingPortal`, outside the normal DOM tree, to avoid stacking-context issues.
- Only one item can be open at a time; opening a new item first closes the current one.
- `AnimatedListItem` is a thin shell component — it returns `Fragment` and holds no state. All logic lives in `AnimatedList`, which reads child `props` via `React.Children.toArray`.
