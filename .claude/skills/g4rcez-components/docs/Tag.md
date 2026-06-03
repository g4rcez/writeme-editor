---
title: Tag
description: A label/badge component for displaying metadata, status, or categorization information.
package: "@g4rcez/components"
export: "{ Tag }"
import: "import { Tag } from '@g4rcez/components/tag'"
category: core
---

# Tag

A versatile label/badge component for displaying metadata, status, or categorization information. Built with polymorphic capabilities and multiple visual variants.

## Import

```tsx
import { Tag } from "@g4rcez/components/tag";
```

## Props

| Prop        | Type                                                                                                                                   | Default     | Description                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------ |
| `theme`     | `"primary" \| "secondary" \| "info" \| "warn" \| "danger" \| "success" \| "muted" \| "neutral" \| "custom" \| "disabled" \| "loading"` | `"primary"` | Visual theme/variant of the tag            |
| `size`      | `"icon" \| "small" \| "default" \| "big" \| "tiny"`                                                                                    | `"default"` | Size of the tag                            |
| `icon`      | `React.ReactNode`                                                                                                                      | -           | Icon to display inside the tag             |
| `indicator` | `"primary" \| "secondary" \| "info" \| "warn" \| "danger" \| "success" \| "muted" \| "neutral"`                                        | -           | Shows a small colored dot before the label |
| `loading`   | `boolean`                                                                                                                              | `false`     | Overrides theme with pulse animation       |
| `as`        | `React.ElementType`                                                                                                                    | `"span"`    | HTML element to render as                  |
| `className` | `string`                                                                                                                               | -           | Additional CSS classes                     |
| `children`  | `React.ReactNode`                                                                                                                      | -           | Tag content                                |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                     | CSS Variable           | Purpose                                |
| ------------------------- | ---------------------- | -------------------------------------- |
| `bg-tag-primary-bg`       | `--tag-primary-bg`     | Background for primary theme           |
| `text-tag-primary-text`   | `--tag-primary-text`   | Text color for primary theme           |
| `bg-tag-secondary-bg`     | `--tag-secondary-bg`   | Background for secondary theme         |
| `text-tag-secondary-text` | `--tag-secondary-text` | Text color for secondary theme         |
| `bg-tag-info-bg`          | `--tag-info-bg`        | Background for info theme              |
| `text-tag-info-text`      | `--tag-info-text`      | Text color for info theme              |
| `bg-tag-warn-bg`          | `--tag-warn-bg`        | Background for warn theme              |
| `text-tag-warn-text`      | `--tag-warn-text`      | Text color for warn theme              |
| `bg-tag-danger-bg`        | `--tag-danger-bg`      | Background for danger theme            |
| `text-tag-danger-text`    | `--tag-danger-text`    | Text color for danger theme            |
| `bg-tag-success-bg`       | `--tag-success-bg`     | Background for success theme           |
| `text-tag-success-text`   | `--tag-success-text`   | Text color for success theme           |
| `bg-tag-muted-bg`         | `--tag-muted-bg`       | Background for muted theme             |
| `text-tag-muted-text`     | `--tag-muted-text`     | Text color for muted theme             |
| `bg-disabled`             | `--disabled`           | Background for disabled/loading states |
| `border-card-border`      | `--card-border`        | Border color for neutral theme         |
| `rounded-tag-radius`      | `--tag-radius`         | Tag border radius                      |
| `bg-primary`              | `--primary`            | Dot color for primary indicator        |
| `bg-secondary`            | `--secondary`          | Dot color for secondary indicator      |
| `bg-info`                 | `--info`               | Dot color for info indicator           |
| `bg-warn`                 | `--warn`               | Dot color for warn indicator           |
| `bg-danger`               | `--danger`             | Dot color for danger indicator         |
| `bg-success`              | `--success`            | Dot color for success indicator        |
| `bg-muted`                | `--muted`              | Dot color for muted indicator          |

## Theme Variants

- `primary`: Primary brand color
- `secondary`: Secondary color scheme
- `info`: Informational styling
- `warn`: Warning/caution styling
- `danger`: Error/destructive styling
- `success`: Success/positive styling
- `muted`: Subtle/subdued styling
- `neutral`: Transparent with card border
- `custom`: No default styling — supply all classes via `className`
- `disabled`: Disabled appearance with reduced opacity
- `loading`: Pulse animation (also triggered by the `loading` boolean prop)

## Examples

### Basic Variants

```tsx
<Tag theme="primary">Primary</Tag>
<Tag theme="secondary">Secondary</Tag>
<Tag theme="info">Info</Tag>
<Tag theme="warn">Warning</Tag>
<Tag theme="danger">Error</Tag>
<Tag theme="success">Success</Tag>
<Tag theme="muted">Muted</Tag>
<Tag theme="neutral">Neutral</Tag>
```

### Sizes

```tsx
<Tag size="small">Small</Tag>
<Tag size="default">Default</Tag>
<Tag size="big">Big</Tag>
```

### With Icons

```tsx
import { StarIcon, CheckIcon } from "@phosphor-icons/react";

<Tag icon={<StarIcon size={14} />} theme="warn">Featured</Tag>
<Tag icon={<CheckIcon size={14} />} theme="success">Completed</Tag>
```

### With Indicators

```tsx
<Tag indicator="success">Online</Tag>
<Tag indicator="danger">Offline</Tag>
<Tag indicator="warn">Pending</Tag>
```

### Status Tags

```tsx
const statusMap: Record<string, { theme: "success" | "warn" | "muted" | "danger" }> = {
    active: { theme: "success" },
    pending: { theme: "warn" },
    inactive: { theme: "muted" },
    error: { theme: "danger" },
};

const StatusTag = ({ status }: { status: string }) => {
    const config = statusMap[status] ?? statusMap.inactive;
    return (
        <Tag theme={config.theme} indicator={config.theme}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </Tag>
    );
};
```

### Loading State

```tsx
<Tag loading theme="primary">
    Processing...
</Tag>
```

### Polymorphic Usage

```tsx
<Tag as="button" onClick={() => void 0} theme="primary">
  Clickable Tag
</Tag>

<Tag as="a" href="/category/react" theme="info">
  React
</Tag>
```

### Content Categorization

```tsx
const categories = [
    { name: "React", theme: "info" },
    { name: "TypeScript", theme: "primary" },
    { name: "CSS", theme: "success" },
];

<div className="flex gap-2 flex-wrap">
    {categories.map((cat) => (
        <Tag key={cat.name} theme={cat.theme as any}>
            {cat.name}
        </Tag>
    ))}
</div>;
```

### Notification Badge

```tsx
import { BellIcon } from "@phosphor-icons/react";

<div className="relative">
    <BellIcon size={24} />
    <Tag size="small" theme="danger" className="absolute -top-2 -right-2 min-w-[20px] h-5 text-xs">
        3
    </Tag>
</div>;
```

## Do

- Use `theme="success"` for positive states and `theme="danger"` for errors — keep it consistent
- Keep tag labels short and scannable
- Use `indicator` to add extra color meaning without extra text
- Use `as="button"` when the tag performs an action (e.g., removing a filter)
- Use design-token classes for wrapper elements (`bg-muted`, `border-border`)

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`) — use `theme` prop instead
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `bg-[--my-var]`) — override CSS variables in your `@theme` block
- Don't use too many different themes on one screen — excessive color variety is distracting
- Don't use `Tag` as a replacement for `Button` on primary actions
- Don't combine `icon` and `indicator` on a small tag — it becomes too visually busy

## Accessibility

- Uses semantic HTML via the `as` prop (defaults to `<span>`)
- The indicator dot is `aria-hidden="true"` — it is purely decorative
- When used as a `button` or `a`, standard keyboard navigation applies
- Ensure color meaning is supplemented by text — do not rely on color alone

## Data Attributes

- `data-component="tag"`: Identifies the component for styling/testing
- `data-theme`: Current theme variant value

## Notes

- The `loading` prop overrides the `theme` value and applies the loading animation
- Once `loading` becomes `false`, the original `theme` is restored
- The component forwards refs to the underlying element
- All standard HTML attributes for the target element are forwarded
