---
title: Button
description: A versatile button component with multiple variants, sizes, and states.
package: "@g4rcez/components"
export: "{ Button }"
import: "import { Button } from '@g4rcez/components/button'"
category: core
---

# Button

A versatile button component with multiple variants, sizes, and states. Built with polymorphic capabilities to render as different HTML elements.

## Import

```tsx
import { Button } from "@g4rcez/components/button";
```

## Props

| Prop        | Type                                                                                                                                                                                                                                                                                           | Default     | Description                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| `theme`     | `"main" \| "primary" \| "secondary" \| "info" \| "warn" \| "danger" \| "success" \| "muted" \| "neutral" \| "ghost-primary" \| "ghost-secondary" \| "ghost-info" \| "ghost-warn" \| "ghost-danger" \| "ghost-success" \| "ghost-muted" \| "ghost-neutral" \| "raw" \| "disabled" \| "loading"` | `"main"`    | Visual theme/variant of the button                                |
| `size`      | `"icon" \| "min" \| "small" \| "default" \| "big" \| "tiny"`                                                                                                                                                                                                                                   | `"default"` | Size of the button                                                |
| `rounded`   | `"rough" \| "squared" \| "default" \| "circle"`                                                                                                                                                                                                                                                | `"default"` | Border radius style                                               |
| `icon`      | `React.ReactNode`                                                                                                                                                                                                                                                                              | -           | Icon to display before button content                             |
| `loading`   | `boolean`                                                                                                                                                                                                                                                                                      | `false`     | Shows loading state with pulse animation and disables interaction |
| `disabled`  | `boolean`                                                                                                                                                                                                                                                                                      | `false`     | Disables the button                                               |
| `as`        | `React.ElementType`                                                                                                                                                                                                                                                                            | `"button"`  | HTML element to render as                                         |
| `type`      | `string`                                                                                                                                                                                                                                                                                       | `"button"`  | Button type attribute                                             |
| `className` | `string`                                                                                                                                                                                                                                                                                       | -           | Additional CSS classes                                            |
| `children`  | `React.ReactNode`                                                                                                                                                                                                                                                                              | -           | Button content                                                    |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                        | CSS Variable              | Purpose                                |
| ---------------------------- | ------------------------- | -------------------------------------- |
| `bg-button-primary-bg`       | `--button-primary-bg`     | Background for primary/main theme      |
| `text-button-primary-text`   | `--button-primary-text`   | Text color for primary/main theme      |
| `bg-button-secondary-bg`     | `--button-secondary-bg`   | Background for secondary theme         |
| `text-button-secondary-text` | `--button-secondary-text` | Text color for secondary theme         |
| `bg-button-info-bg`          | `--button-info-bg`        | Background for info theme              |
| `text-button-info-text`      | `--button-info-text`      | Text color for info theme              |
| `bg-button-warn-bg`          | `--button-warn-bg`        | Background for warn theme              |
| `text-button-warn-text`      | `--button-warn-text`      | Text color for warn theme              |
| `bg-button-danger-bg`        | `--button-danger-bg`      | Background for danger theme            |
| `text-button-danger-text`    | `--button-danger-text`    | Text color for danger theme            |
| `bg-button-success-bg`       | `--button-success-bg`     | Background for success theme           |
| `text-button-success-text`   | `--button-success-text`   | Text color for success theme           |
| `bg-button-muted-bg`         | `--button-muted-bg`       | Background for muted theme             |
| `text-button-muted-text`     | `--button-muted-text`     | Text color for muted theme             |
| `bg-disabled`                | `--disabled`              | Background for disabled/loading states |
| `border-card-border`         | `--card-border`           | Border color for neutral theme         |
| `rounded-button-radius`      | `--button-radius`         | Default border radius                  |
| `focus-visible:ring-ring`    | `--ring`                  | Focus ring color                       |

## Theme Variants

### Solid Variants

- `main` / `primary`: Primary brand action
- `secondary`: Secondary action
- `info`: Informational action
- `warn`: Warning action
- `danger`: Destructive action
- `success`: Confirmation/success action
- `muted`: Subtle/subdued appearance
- `neutral`: Transparent with card border

### Ghost Variants

Transparent background with colored text; shows a tinted background on hover.

- `ghost-primary`, `ghost-secondary`, `ghost-info`, `ghost-warn`, `ghost-danger`, `ghost-success`, `ghost-muted`, `ghost-neutral`

### Special Variants

- `raw`: No default styling — supply all classes via `className`
- `disabled`: Disabled visual appearance (use the `disabled` prop for full behavior)
- `loading`: Pulse animation with muted background

## Examples

### Basic Variants

```tsx
<Button theme="primary">Primary</Button>
<Button theme="secondary">Secondary</Button>
<Button theme="danger">Delete</Button>
<Button theme="success">Save</Button>
```

### Sizes

```tsx
<Button size="min">Mini</Button>
<Button size="small">Small</Button>
<Button size="default">Default</Button>
<Button size="big">Big</Button>
```

### With Icons

```tsx
import { PlusIcon } from "@phosphor-icons/react";

<Button icon={<PlusIcon size={16} />}>Add Item</Button>

<Button size="icon" theme="ghost-primary">
  <PlusIcon size={16} />
</Button>
```

### Loading State

```tsx
<Button loading>Saving...</Button>
```

### Ghost Variants

```tsx
<Button theme="ghost-primary">Ghost Primary</Button>
<Button theme="ghost-danger">Ghost Danger</Button>
```

### Polymorphic Usage

```tsx
<Button as="a" href="/dashboard" theme="primary">
    Go to Dashboard
</Button>
```

### Rounded Variants

```tsx
<Button rounded="squared">Squared</Button>
<Button rounded="circle" size="icon">
  <PlusIcon size={16} />
</Button>
```

## Do

- Use `theme="primary"` for the single main action on a page
- Use `theme="danger"` for destructive actions (delete, remove)
- Use the `loading` prop to give immediate feedback for async operations
- Use `as="a"` with `href` when the button navigates to a URL
- Use design-token classes for any wrapper elements (`bg-primary`, `text-foreground`)

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`) — use `theme` prop instead
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `bg-[--my-var]`) — override CSS variables in your `@theme` block
- Don't place multiple `theme="primary"` buttons in the same view
- Don't use `theme="primary"` for destructive actions — use `theme="danger"` instead

## Accessibility

- Renders as a semantic `<button>` element by default
- Sets `aria-disabled` when `disabled` or `loading` is true
- Sets `aria-busy` during loading state
- Click handlers are automatically removed while loading or disabled
- Supports visible focus rings via `focus-visible:ring-4 focus-visible:ring-ring`
- Keyboard navigation is fully supported

## Data Attributes

- `data-component="button"`: Identifies the component for styling/testing
- `data-theme`: Current theme variant value
- `data-loading`: `"true"` when in loading state, `"false"` otherwise

## Notes

- When `loading` is `true`, `disabled` is also set to `true` automatically
- The component forwards refs correctly to the underlying element
- All standard HTML button (or target element) attributes are forwarded
- The `as` prop enables rendering as any HTML element or React component while preserving full TypeScript type safety
