---
title: Card
description: Polymorphic container for grouping related content with optional title header, loading state, and composable sub-components.
package: "@g4rcez/components"
export: "{ Card }"
import: "import { Card } from '@g4rcez/components/card'"
category: display
---

# Card

Polymorphic container for grouping related content with optional title header, loading state, and composable sub-components.

## Import

```tsx
import { Card } from "@g4rcez/components/card";
```

## Props

### Card

| Prop             | Type                         | Default | Description                                       |
| ---------------- | ---------------------------- | ------- | ------------------------------------------------- |
| `title`          | `React.ReactNode`            | —       | Renders an automatic header with border separator |
| `loading`        | `boolean`                    | —       | Replaces content with animated skeleton lines     |
| `titleClassName` | `string`                     | `""`    | Additional classes for the title header element   |
| `header`         | `React.ReactElement \| null` | `null`  | Custom header element; overrides `title`          |
| `container`      | `string`                     | `""`    | Additional classes for the outer card element     |
| `as`             | `React.ElementType`          | `"div"` | Polymorphic root element                          |
| `className`      | `string`                     | `""`    | Additional classes for the card body element      |
| `children`       | `React.ReactNode`            | —       | Card body content                                 |

### Card.Title

A composable header with a title and an optional navigation/action area.

| Prop       | Type                           | Default | Description                                     |
| ---------- | ------------------------------ | ------- | ----------------------------------------------- |
| `title`    | `React.ReactElement \| string` | —       | Title content                                   |
| `titleTag` | `React.ElementType`            | `"h2"`  | Element type for the title                      |
| `navTag`   | `React.ElementType`            | `"nav"` | Element type for the actions wrapper            |
| `as`       | `React.ElementType`            | `"div"` | Element type for the container                  |
| `children` | `React.ReactNode`              | —       | Action elements rendered in the navigation area |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                 | CSS Variable        | Purpose                         |
| --------------------- | ------------------- | ------------------------------- |
| `bg-card-background`  | `--card-background` | Card surface color              |
| `border-card-border`  | `--card-border`     | Card border and title separator |
| `rounded-card-radius` | `--card-radius`     | Corner radius                   |
| `shadow-shadow-card`  | `--shadow-card`     | Card drop shadow                |
| `bg-muted`            | `--muted`           | Skeleton loading lines          |

## Examples

### Basic Card

```tsx
<Card>
    <p>Card content goes here.</p>
</Card>
```

### Card with Title

```tsx
<Card title="User Profile">
    <div className="space-y-4">
        <p>Name: John Doe</p>
        <p>Email: john@example.com</p>
    </div>
</Card>
```

### Card with Loading State

```tsx
<Card title="Analytics" loading={isLoading}>
    <p>Loaded content rendered here when not loading.</p>
</Card>
```

### Card.Title with Actions

```tsx
import { Button } from "@g4rcez/components/button";

<Card>
    <Card.Title title="Project Overview">
        <Button theme="primary" size="small">
            Edit
        </Button>
        <Button theme="neutral" size="small">
            Share
        </Button>
    </Card.Title>

    <p>Project description and details.</p>
</Card>;
```

### Custom Header

```tsx
<Card
    header={
        <header className="flex justify-between items-center p-4 border-b border-card-border">
            <h2 className="text-foreground font-semibold">Custom Header</h2>
        </header>
    }
>
    <p>Content with a completely custom header.</p>
</Card>
```

### Nested Cards

```tsx
<Card title="Dashboard">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Statistics">
            <p>Chart content here</p>
        </Card>
        <Card title="Recent Activity">
            <ul>
                <li>User logged in</li>
                <li>New order received</li>
            </ul>
        </Card>
    </div>
</Card>
```

### Semantic Element

```tsx
<Card as="article" title="Blog Post">
    <p>Blog post content.</p>
</Card>
```

## Do

- Use `title` or `Card.Title` to give cards a clear, descriptive heading.
- Use `as="article"` or `as="section"` when semantics matter.
- Use `loading={true}` while data is fetching to prevent layout shift.
- Maintain consistent spacing between multiple cards in a grid using gap utilities.
- Use design-token classes for wrapper elements (`bg-background`, `border-border`).

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`, `border-gray-300`) — use design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `bg-[--my-var]`) — override CSS variables in your `@theme` block instead.
- Don't over-nest cards; multiple borders and shadows create visual clutter.
- Don't put more than one primary action in a single `Card.Title` — keep actions focused.

## Accessibility

- Uses semantic HTML; `Card.Title` renders an `h2` by default (configurable via `titleTag`).
- Polymorphic `as` prop allows correct element type for document structure.
- Interactive elements within cards remain keyboard accessible.

## Data Attributes

- `data-component="card"` — outer card element.
- `data-component="card-title"` — automatic title header.
- `data-component="card-body"` — card body wrapper.

## Notes

- When both `title` and `header` are provided, `title` takes precedence and `header` is ignored.
- The `loading` prop replaces children with four `Skeleton` lines of varying widths.
- `Card.Title` lays out title and actions responsively: stacked on mobile, inline on `sm+`.
