---
title: List
description: Animated list that expands each item into a focused floating detail overlay when clicked.
package: "@g4rcez/components"
export: "{ AnimatedList, AnimatedListItem }"
import: "import { AnimatedList, AnimatedListItem } from '@g4rcez/components/list'"
category: display
---

# List

Animated list that expands each item into a focused floating detail overlay when clicked.

`AnimatedList` and `AnimatedListItem` are exported from the `@g4rcez/components/list` subpath. Each row in the list is clickable; selecting a row opens a `motion/react`-animated card overlay with the item's full content.

## Import

```tsx
import { AnimatedList, AnimatedListItem } from "@g4rcez/components/list";
```

## Props

### AnimatedList

| Prop       | Type              | Default | Description                              |
| ---------- | ----------------- | ------- | ---------------------------------------- |
| `children` | `React.ReactNode` | —       | One or more `AnimatedListItem` elements. |

### AnimatedListItem

| Prop          | Type                             | Default | Description                                                                                                                      |
| ------------- | -------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `title`       | `Label`                          | —       | Primary heading shown in the list row and in the overlay header.                                                                 |
| `description` | `Label`                          | —       | Secondary text rendered below the title in both the row and the overlay.                                                         |
| `children`    | `Label`                          | —       | Content rendered inside the expanded overlay below the header section.                                                           |
| `avatar`      | `Label`                          | —       | Optional leading node (image, icon, or element) displayed before the title in the row.                                           |
| `leading`     | `React.FC<{ open: () => void }>` | —       | Optional render-prop component at the trailing end of the row. Receives an `open` callback to open the overlay programmatically. |

`Label` is `string | number | ReactNode`.

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                 | CSS Variable         | Purpose                                                             |
| --------------------- | -------------------- | ------------------------------------------------------------------- |
| `border-card-border`  | `--card-border`      | Row separator and overlay card border                               |
| `bg-card-background`  | `--card-background`  | Overlay card background color                                       |
| `rounded-list-radius` | `--list-radius`      | Overlay card corner radius                                          |
| `shadow-shadow-card`  | `--shadow-card`      | Overlay card drop shadow                                            |
| `text-foreground`     | `--foreground`       | Default text color for row and overlay content                      |
| `text-secondary`      | `--secondary`        | Description text color                                              |
| `text-primary`        | `--primary`          | Row title hover color and avatar focus ring                         |
| `text-danger`         | `--danger`           | Close button hover color in the overlay                             |
| `bg-floating-overlay` | `--floating-overlay` | Semi-transparent backdrop behind the overlay (used at 70 % opacity) |
| `z-floating`          | `--z-floating`       | `z-index` for the overlay card (value: 22)                          |
| `z-overlay`           | `--z-overlay`        | `z-index` for the backdrop scrim                                    |

## Examples

### Basic usage

```tsx
import { AnimatedList, AnimatedListItem } from "@g4rcez/components/list";

const members = [
    { id: "1", name: "Alice Johnson", role: "Engineering" },
    { id: "2", name: "Bob Smith", role: "Design" },
];

export function TeamList() {
    return (
        <AnimatedList>
            {members.map((m) => (
                <AnimatedListItem key={m.id} title={m.name} description={m.role}>
                    <p className="text-foreground">Full profile for {m.name}.</p>
                </AnimatedListItem>
            ))}
        </AnimatedList>
    );
}
```

### With avatar

```tsx
import { AnimatedList, AnimatedListItem } from "@g4rcez/components/list";
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
                    <span>Department: Product</span>
                    <span>Location: San Francisco</span>
                </div>
            </AnimatedListItem>
        </AnimatedList>
    );
}
```

### With trailing action using `leading`

```tsx
import { AnimatedList, AnimatedListItem } from "@g4rcez/components/list";
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

### Notification / activity feed

```tsx
import { AnimatedList, AnimatedListItem } from "@g4rcez/components/list";
import { CheckCircleIcon, WarningIcon } from "@phosphor-icons/react";

const feed = [
    {
        id: "n1",
        icon: <CheckCircleIcon size={20} className="text-success" />,
        title: "Deployment succeeded",
        time: "2 min ago",
        detail: "All 3 services are healthy.",
    },
    {
        id: "n2",
        icon: <WarningIcon size={20} className="text-warn" />,
        title: "High CPU usage",
        time: "10 min ago",
        detail: "Instance i-0ab2 is at 94 %.",
    },
];

export function NotificationFeed() {
    return (
        <AnimatedList>
            {feed.map((n) => (
                <AnimatedListItem key={n.id} title={n.title} description={n.time} avatar={n.icon}>
                    <p className="text-sm text-muted-foreground">{n.detail}</p>
                </AnimatedListItem>
            ))}
        </AnimatedList>
    );
}
```

## Do

- Keep `title` and `description` short — they share a single row and are not truncated automatically.
- Provide meaningful `children` content in the overlay to justify clicking the row.
- Use `leading` to expose a primary call-to-action alongside the title without forcing the user to open the overlay.
- Use design-token classes inside the overlay content (`bg-card-background`, `text-foreground`, `border-card-border`).

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`, `border-gray-300`) — use design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `bg-[--my-var]`) — override CSS variables in your `@theme` block instead.
- Don't use this component for purely informational lists where no detail overlay is needed — use a plain `<ul>` instead.
- Don't embed full applications or heavy forms inside the overlay `children`; use a `Modal` for complex workflows.
- Don't render `AnimatedListItem` outside of `AnimatedList` — the item component returns a `Fragment` and relies entirely on the parent list for rendering.

## Accessibility

- The list renders as `<ul role="list">`.
- Each row title/description area is a `<button>`, making it keyboard focusable and activatable with `Enter` or `Space`.
- The overlay uses `FloatingFocusManager` to trap focus and `FloatingOverlay` with `lockScroll` to block background interaction.
- Pressing `Escape`, clicking outside, or clicking the close button dismisses the overlay.
- The close button inside the overlay is a focusable `<button>` with an `XIcon`.
- `MotionConfig reducedMotion="user"` honours the system-level reduced-motion preference, disabling animations when requested.

## Data Attributes

- `layoutId="item-{id}"` — shared between the list row `<li>` and the overlay card `<motion.div>` to drive the shared-element expand/collapse animation.
- `layoutId="toast-{id}"` — inner content wrapper for coordinated layout transitions.

## Notes

- Only one item can be open at a time; selecting a new item dismisses the previous overlay automatically.
- `AnimatedListItem` is a shell — it returns a `Fragment` directly and holds no state. All rendering logic lives inside `AnimatedList`, which reads child props via `React.Children.toArray`.
- The overlay is rendered in a `FloatingPortal` (outside the DOM tree) to avoid stacking-context or overflow clipping issues.
- Animations use `motion/react` shared-layout (`layoutId`) so the item card expands smoothly from its row position to the center of the viewport.
- The animation transition is `tween` with a 0.3 s duration; `stiffness` is set low (25) for a relaxed feel.
