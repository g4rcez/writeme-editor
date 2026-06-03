---
title: Alert
description: Collapsible, themed alert banner for displaying important messages and status updates.
package: "@g4rcez/components"
export: "{ Alert }"
import: "import { Alert } from '@g4rcez/components/alert'"
category: display
---

# Alert

Collapsible, themed alert banner for displaying important messages and status updates.

## Import

```tsx
import { Alert } from "@g4rcez/components/alert";
```

## Props

| Prop        | Type                                                                                 | Default     | Description                                                    |
| ----------- | ------------------------------------------------------------------------------------ | ----------- | -------------------------------------------------------------- |
| `theme`     | `"primary" \| "secondary" \| "info" \| "warn" \| "danger" \| "success" \| "neutral"` | `"neutral"` | Visual theme variant                                           |
| `title`     | `string`                                                                             | —           | Alert heading text                                             |
| `Icon`      | `React.ReactElement`                                                                 | —           | Custom icon element (overrides default theme icon)             |
| `open`      | `boolean`                                                                            | `true`      | Controls visibility with collapse animation                    |
| `onClose`   | `(nextState: boolean) => void`                                                       | —           | Callback when close button is clicked; omit to hide the button |
| `container` | `string`                                                                             | —           | Additional classes for the outer wrapper                       |
| `as`        | `React.ElementType`                                                                  | `"div"`     | Polymorphic root element                                       |
| `className` | `string`                                                                             | —           | Additional classes for the alert element                       |
| `children`  | `React.ReactNode`                                                                    | —           | Alert body content                                             |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                         | CSS Variable             | Purpose                    |
| ----------------------------- | ------------------------ | -------------------------- |
| `bg-alert-{theme}-bg`         | `--alert-{theme}-bg`     | Background per theme       |
| `text-alert-{theme}-text`     | `--alert-{theme}-text`   | Text color per theme       |
| `border-alert-{theme}-border` | `--alert-{theme}-border` | Border color per theme     |
| `border-card-border`          | `--card-border`          | Border for `neutral` theme |
| `text-foreground`             | `--foreground`           | Close button color         |
| `text-danger`                 | `--danger`               | Close button hover color   |

Themes: `primary`, `secondary`, `info`, `warn`, `danger`, `success`, `neutral`.

## Themes

Each theme maps to a set of `bg-alert-{theme}-*` tokens and provides default icons for some variants:

| Theme                               | Default Icon        |
| ----------------------------------- | ------------------- |
| `success`                           | `CheckCircleIcon`   |
| `info`                              | `InfoIcon`          |
| `danger`                            | `TriangleAlertIcon` |
| `warn`                              | —                   |
| `primary` / `secondary` / `neutral` | —                   |

## Examples

### Basic Variants

```tsx
<Alert theme="info" title="Information">
  This is an informational message.
</Alert>

<Alert theme="success" title="Success">
  Your changes have been saved successfully.
</Alert>

<Alert theme="warn" title="Warning">
  Please review your input before proceeding.
</Alert>

<Alert theme="danger" title="Error">
  Something went wrong. Please try again.
</Alert>
```

### With Custom Icon

```tsx
import { BellIcon } from "@phosphor-icons/react";

<Alert theme="info" title="Notification" Icon={<BellIcon size={20} />}>
    You have new messages.
</Alert>;
```

### Dismissible Alert

```tsx
const [showAlert, setShowAlert] = useState(true);

<Alert theme="success" title="Welcome!" open={showAlert} onClose={() => setShowAlert(false)}>
    Thanks for joining our platform.
</Alert>;
```

### Rich Content

```tsx
import { Button } from "@g4rcez/components/button";

<Alert theme="info" title="Update Available">
    <p>A new version of the application is available.</p>
    <div className="mt-3 flex gap-2">
        <Button theme="primary" size="small">
            Update Now
        </Button>
        <Button theme="neutral" size="small">
            Later
        </Button>
    </div>
</Alert>;
```

### Form Validation

```tsx
const [errors, setErrors] = useState<string[]>([]);

<Alert theme="danger" title="Validation Errors" open={errors.length > 0}>
    <ul className="list-disc list-inside space-y-1">
        {errors.map((error, index) => (
            <li key={index}>{error}</li>
        ))}
    </ul>
</Alert>;
```

## Do

- Use `theme` to match message severity (`danger` for errors, `success` for completions, `warn` for cautions).
- Provide a concise, descriptive `title` so users immediately understand the alert.
- Supply `onClose` when the alert should be user-dismissible.
- Use design-token classes for any wrapper elements (`bg-background`, `border-border`).

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`, `border-gray-300`) — use `theme` or design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `bg-[--my-var]`) — override CSS variables in your `@theme` block instead.
- Don't use `danger` for non-critical information; use `warn` or `info` instead.
- Don't omit `onClose` if the alert must be dismissible — the close button only renders when the prop is provided.

## Accessibility

- Renders with `role="alert"` for immediate screen reader announcement.
- Title uses a semantic `h4` element for proper heading hierarchy.
- Close button is keyboard accessible and uses a visible icon.
- The `aria-hidden` attribute on the collapse wrapper prevents interaction with hidden content.

## Data Attributes

- `data-component="alert"` — outer wrapper element.
- `data-theme` — current theme variant (e.g. `"danger"`).
- `data-open` — current visibility state (`"true"` / `"false"`).

## Notes

- Animation uses Framer Motion (`motion/react`): 0.7 s collapse/expand with spring easing.
- When `open` becomes `false`, the alert collapses and is removed from the DOM via `AnimatePresence`.
- The component is polymorphic — pass `as="section"` or any other element type via the `as` prop.
