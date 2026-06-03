---
title: Timeline
description: Vertical chronological event list with icon markers, body content, and optional right-side metadata.
package: "@g4rcez/components"
export: "{ Timeline }"
import: "import { Timeline, TimelineItem } from '@g4rcez/components/timeline'"
category: display
---

# Timeline

Vertical chronological event list with icon markers, body content, and optional right-side metadata.

## Import

```tsx
import { Timeline, TimelineItem } from "@g4rcez/components/timeline";
```

## Components

### Timeline

The root container. Renders as a `<ul>` with `role="list"`. The vertical connector line on the last item is hidden automatically.

### TimelineItem

A single event entry. Renders as a `<li>` with `role="listitem"` and `pb-12` vertical spacing for the connector line.

### TimelineItem.Icon

The visual marker — a rounded circle, typically containing an icon. Renders as a `<header>`.

| Prop        | Type              | Default | Description                        |
| ----------- | ----------------- | ------- | ---------------------------------- |
| `className` | `string`          | —       | Override icon container appearance |
| `children`  | `React.ReactNode` | —       | Icon element                       |

### TimelineItem.Body

The main content area. Polymorphic — defaults to `<section>`.

| Prop        | Type                | Default     | Description               |
| ----------- | ------------------- | ----------- | ------------------------- |
| `as`        | `React.ElementType` | `"section"` | HTML element to render as |
| `className` | `string`            | —           | Additional classes        |
| `children`  | `React.ReactNode`   | —           | Event body content        |

### TimelineItem.Right

Optional right-side slot for timestamps or auxiliary actions. Renders inside a `<footer>` wrapper. Polymorphic — defaults to `<button>`.

| Prop       | Type                | Default    | Description               |
| ---------- | ------------------- | ---------- | ------------------------- |
| `as`       | `React.ElementType` | `"button"` | HTML element to render as |
| `children` | `React.ReactNode`   | —          | Right-side content        |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                     | CSS Variable           | Purpose                           |
| ------------------------- | ---------------------- | --------------------------------- |
| `bg-card-border`          | `--card-border`        | Vertical connector line color     |
| `bg-primary`              | `--primary`            | Icon container default background |
| `text-primary-foreground` | `--primary-foreground` | Icon default text/icon color      |

## Examples

### Order Tracking Timeline

```tsx
import { CheckIcon, PackageIcon, TruckIcon } from "@phosphor-icons/react";

<Timeline>
    <TimelineItem>
        <TimelineItem.Icon>
            <CheckIcon size={20} />
        </TimelineItem.Icon>
        <TimelineItem.Body>
            <h4 className="font-bold">Order Placed</h4>
            <p className="text-muted-foreground">Your order has been received and is being processed.</p>
        </TimelineItem.Body>
        <TimelineItem.Right as="time">10:00 AM</TimelineItem.Right>
    </TimelineItem>

    <TimelineItem>
        <TimelineItem.Icon>
            <PackageIcon size={20} />
        </TimelineItem.Icon>
        <TimelineItem.Body>
            <h4 className="font-bold">Packed</h4>
            <p className="text-muted-foreground">Your order has been packed and is ready for shipment.</p>
        </TimelineItem.Body>
        <TimelineItem.Right as="time">1:00 PM</TimelineItem.Right>
    </TimelineItem>

    <TimelineItem>
        <TimelineItem.Icon>
            <TruckIcon size={20} />
        </TimelineItem.Icon>
        <TimelineItem.Body>
            <h4 className="font-bold">Shipped</h4>
            <p className="text-muted-foreground">Your package is on its way.</p>
        </TimelineItem.Body>
        <TimelineItem.Right as="time">2:30 PM</TimelineItem.Right>
    </TimelineItem>
</Timeline>;
```

### Simple Text Timeline

```tsx
<Timeline>
    <TimelineItem>
        <TimelineItem.Body>
            <strong>Step 1:</strong> Initial setup completed.
        </TimelineItem.Body>
    </TimelineItem>
    <TimelineItem>
        <TimelineItem.Body>
            <strong>Step 2:</strong> Data migration started.
        </TimelineItem.Body>
    </TimelineItem>
</Timeline>
```

### Activity Feed

```tsx
import { UserIcon, PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react";

function ActivityFeed({ events }: { events: ActivityEvent[] }) {
    const iconMap = {
        create: UserIcon,
        update: PencilSimpleIcon,
        delete: TrashIcon,
    };

    return (
        <Timeline>
            {events.map((event) => {
                const Icon = iconMap[event.type];
                return (
                    <TimelineItem key={event.id}>
                        <TimelineItem.Icon>
                            <Icon size={18} />
                        </TimelineItem.Icon>
                        <TimelineItem.Body>
                            <p className="font-medium">
                                {event.user} {event.action}
                            </p>
                            <p className="text-sm text-muted-foreground">{event.description}</p>
                        </TimelineItem.Body>
                        <TimelineItem.Right as="time" dateTime={event.iso}>
                            {event.relativeTime}
                        </TimelineItem.Right>
                    </TimelineItem>
                );
            })}
        </Timeline>
    );
}
```

### Custom Icon Background

```tsx
import { WarningCircleIcon } from "@phosphor-icons/react";

<TimelineItem>
    <TimelineItem.Icon className="bg-danger text-danger-foreground">
        <WarningCircleIcon size={20} />
    </TimelineItem.Icon>
    <TimelineItem.Body>
        <h4 className="font-bold text-danger-foreground">Deployment Failed</h4>
        <p className="text-muted-foreground">Build step exited with code 1.</p>
    </TimelineItem.Body>
</TimelineItem>;
```

## Do

- Use icons that clearly represent the status or type of event.
- Keep body content concise; link to a detail view for lengthy information.
- Maintain consistent chronological order (ascending or descending) throughout the list.
- Use semantic elements for timestamps — `as="time"` with a `dateTime` attribute.
- Use design-token classes for icon background overrides (`bg-success`, `bg-danger`).

## Don't

- Don't pass raw Tailwind color classes (`bg-green-500`, `text-red-600`) for icon backgrounds — use design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`) — override CSS variables in your `@theme` block.
- Don't cram too much information into a single `TimelineItem`; link to detail pages.
- Don't use `Timeline` for non-sequential data — use `List` or `Table` for unordered collections.

## Accessibility

- `Timeline` uses `<ul role="list">` and each `TimelineItem` uses `<li role="listitem">` for semantic list structure.
- The vertical connector `<span>` between items carries `aria-hidden="true"` since it is purely decorative.
- The last item's connector line is hidden via a CSS selector (`[&>li:last-child>span[aria-hidden=true]]:hidden`), removing it from layout without JS.

## Data Attributes

- `data-component="timeline"` — applied to the `<ul>` container.
- `data-component="timeline-item"` — applied to each `<li>` entry.

## Notes

- `TimelineItem.Right` defaults to `as="button"` — change to `as="time"` or `as="span"` if the right slot is non-interactive.
- Vertical spacing between entries is controlled by `pb-12` on `TimelineItem`; the connector line fills this gap.
- `TimelineItem` can be used without `TimelineItem.Icon` — the connector line still renders from the left edge.
