---
title: Typography
description: A set of text and page-structure components for consistent typographic styling.
package: "@g4rcez/components"
export: "{ Paragraph, Description, Info, PageTitle, PageHeader }"
import: "import { Paragraph, Description, Info, PageTitle, PageHeader } from '@g4rcez/components'"
category: core
---

# Typography

A set of text and page-structure components for consistent typographic styling across the application. Exports `Paragraph`, `Description`, `Info`, `PageTitle`, and `PageHeader`.

## Import

```tsx
import { Paragraph, Description, Info, PageTitle, PageHeader } from "@g4rcez/components";
```

## Props

### Paragraph

Renders a `<p>` element with `text-base leading-snug`.

| Prop        | Type                        | Default | Description                   |
| ----------- | --------------------------- | ------- | ----------------------------- |
| `children`  | `React.ReactNode`           | -       | Paragraph content             |
| `className` | `string`                    | -       | Additional CSS classes        |
| `...props`  | `React.ComponentProps<"p">` | -       | All standard `<p>` attributes |

### Description

Renders a `<p>` element with `text-sm text-secondary mb-kilo`.

| Prop        | Type                        | Default | Description                   |
| ----------- | --------------------------- | ------- | ----------------------------- |
| `children`  | `React.ReactNode`           | -       | Description content           |
| `className` | `string`                    | -       | Additional CSS classes        |
| `...props`  | `React.ComponentProps<"p">` | -       | All standard `<p>` attributes |

### Info

Renders a labeled key-value pair in a flex container.

| Prop              | Type              | Default | Description                                                |
| ----------------- | ----------------- | ------- | ---------------------------------------------------------- |
| `label`           | `Label`           | -       | The label text (required)                                  |
| `children`        | `React.ReactNode` | -       | The value content                                          |
| `row`             | `boolean`         | `false` | Renders label and value side-by-side instead of stacked    |
| `disabled`        | `Label`           | -       | When set, applies `text-disabled` to the value             |
| `className`       | `string`          | -       | Additional classes for the container                       |
| `info`            | `Label`           | -       | Reserved field (available in type, not currently rendered) |
| `infoDescription` | `string`          | -       | Reserved field (available in type, not currently rendered) |

### PageTitle

Renders an `<h2>` title with a paragraph subtitle.

| Prop       | Type              | Default | Description                               |
| ---------- | ----------------- | ------- | ----------------------------------------- |
| `title`    | `string`          | -       | Main title text (required)                |
| `children` | `React.ReactNode` | -       | Subtitle or description beneath the title |

### PageHeader

Renders a `<header>` element with title/description on the left and action slots on the right.

| Prop          | Type              | Default | Description                                    |
| ------------- | ----------------- | ------- | ---------------------------------------------- |
| `title`       | `string`          | -       | Page title (required)                          |
| `description` | `Label`           | -       | Short description beneath the title (required) |
| `children`    | `React.ReactNode` | -       | Action buttons or other right-aligned content  |

## Design Tokens

Tokens these components read. Customize by overriding these CSS variables in your theme.

| Token            | CSS Variable     | Purpose                                  |
| ---------------- | ---------------- | ---------------------------------------- |
| `text-secondary` | `--secondary`    | Description and subtitle text color      |
| `text-disabled`  | `--disabled`     | Disabled value text in `Info`            |
| `mb-kilo`        | `--spacing-kilo` | Bottom margin on `Description`           |
| `gap-mega`       | `--spacing-mega` | Gap in `PageHeader` between sections     |
| `gap-kilo`       | `--spacing-kilo` | Gap between action items in `PageHeader` |

## Examples

### Page Header with Actions

```tsx
import { Button } from "@g4rcez/components/button";

<PageHeader title="Orders" description="List of all orders from your shop">
    <Button size="small">Export CSV</Button>
    <Button theme="primary" size="small">
        Create Order
    </Button>
</PageHeader>;
```

### Standalone Page Title

```tsx
<PageTitle title="Dashboard">Overview of your application metrics</PageTitle>
```

### Paragraph and Description

```tsx
<Paragraph>
  This is a standard paragraph with base font size and snug line height.
</Paragraph>

<Description>
  Secondary description text, typically used beneath form fields or titles.
</Description>
```

### Info — Stacked (default)

```tsx
<Info label="Full Name">John Doe</Info>
<Info label="Email">john@example.com</Info>
<Info label="Role">Administrator</Info>
```

### Info — Row Layout

```tsx
<Info label="Status" row>Active</Info>
<Info label="Plan" row>Pro</Info>
```

### Info — Disabled Value

```tsx
<Info label="API Key" disabled="true">
    sk-••••••••••••••••
</Info>
```

### Profile Card

```tsx
<div className="flex flex-col gap-base rounded-card-radius border border-border bg-card-background p-4">
    <PageTitle title="John Doe">Software Engineer</PageTitle>
    <div className="flex flex-col gap-sm">
        <Info label="Email" row>
            john@example.com
        </Info>
        <Info label="Team" row>
            Platform
        </Info>
        <Info label="Joined" row>
            March 2024
        </Info>
    </div>
</div>
```

## Do

- Use `PageHeader` at the top of every page for consistent title + action layout
- Use `Paragraph` instead of raw `<p>` to inherit consistent base styling
- Use `Description` for secondary/supporting text — it signals lower visual hierarchy
- Use design-token classes for any additional styling (`text-foreground`, `bg-background`)

## Don't

- Don't use `PageTitle` more than once per page — it represents the page's main topic
- Don't pass raw Tailwind color classes (`text-gray-500`, `text-black`) — use `text-secondary` or `text-foreground`
- Don't use arbitrary Tailwind values (`text-[#555]`) — override CSS variables in your `@theme` block
- Don't use `Info` for long-form content — it is designed for short labeled values

## Accessibility

- `PageTitle` renders an `<h2>` — ensure there is an `<h1>` elsewhere on the page
- `PageHeader` wraps content in a semantic `<header>` element
- `Info` labels are `<span>` elements; if the label identifies a form field, prefer a `<label>` with `htmlFor` instead
- `Description` text should be concise and supplementary — do not place critical content only in `Description`

## Notes

- All components accept standard HTML props for their root element and merge `className` correctly
- `PageHeader` uses `gap-mega` and `gap-kilo` spacing tokens — override these in `@theme` to adjust layout rhythm
- `Info` with `disabled` prop applies `text-disabled` to the value span only, not the label
