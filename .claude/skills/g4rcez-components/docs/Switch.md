---
title: Switch
description: Toggle switch for switching between two mutually exclusive states such as On/Off.
package: "@g4rcez/components"
export: "{ Switch }"
import: "import { Switch } from '@g4rcez/components/switch'"
category: form
---

# Switch

Toggle switch for switching between two mutually exclusive states such as On/Off.

## Import

```tsx
import { Switch } from "@g4rcez/components/switch";
```

## Props

Inherits all standard HTML `input[type="checkbox"]` attributes, plus:

| Prop        | Type                           | Default | Description                                          |
| ----------- | ------------------------------ | ------- | ---------------------------------------------------- |
| `children`  | `React.ReactNode`              | —       | Label text or element displayed next to the switch.  |
| `onCheck`   | `(nextValue: boolean) => void` | —       | Called with the new boolean value after toggling.    |
| `error`     | `string`                       | —       | Error message displayed below the switch.            |
| `loading`   | `boolean`                      | `false` | Disables the switch and signals a pending operation. |
| `container` | `string`                       | —       | Additional CSS classes for the outer `<fieldset>`.   |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                | CSS Variable        | Purpose                         |
| -------------------- | ------------------- | ------------------------------- |
| `bg-input-switch-bg` | `--input-switch-bg` | Track background when unchecked |
| `bg-primary`         | `--primary`         | Track background when checked   |
| `bg-disabled`        | `--disabled`        | Thumb fill when unchecked       |
| `bg-input-switch`    | `--input-switch`    | Thumb fill when checked         |
| `focus:ring-primary` | `--primary`         | Focus ring on the toggle button |
| `text-danger`        | `--danger`          | Error message color             |
| `text-foreground`    | `--foreground`      | Label text color                |

## Themes

The switch appearance is driven entirely by design tokens. Override them in your `@theme` block to change the checked/unchecked colors across the application.

## Examples

### Basic toggle

```tsx
import { Switch } from "@g4rcez/components/switch";

export default function NotificationsToggle() {
    return (
        <Switch defaultChecked onChange={(e) => console.log(e.target.checked)}>
            Enable notifications
        </Switch>
    );
}
```

### Controlled switch

```tsx
import { useState } from "react";
import { Switch } from "@g4rcez/components/switch";

export default function DarkModeToggle() {
    const [enabled, setEnabled] = useState(false);

    return (
        <Switch checked={enabled} onCheck={setEnabled}>
            Dark mode
        </Switch>
    );
}
```

### With loading state

```tsx
import { Switch } from "@g4rcez/components/switch";

export default function SyncSwitch() {
    return <Switch loading>Syncing data…</Switch>;
}
```

### With error message

```tsx
import { Switch } from "@g4rcez/components/switch";

export default function TermsSwitch() {
    return <Switch error="You must accept the terms to continue">Accept terms and conditions</Switch>;
}
```

### In a settings form

```tsx
import { Switch } from "@g4rcez/components/switch";

export default function PrivacySettings() {
    return (
        <div className="flex flex-col gap-base">
            <Switch defaultChecked onCheck={(v) => updateSetting("emails", v)}>
                Receive marketing emails
            </Switch>
            <Switch onCheck={(v) => updateSetting("analytics", v)}>Share analytics data</Switch>
            <Switch defaultChecked onCheck={(v) => updateSetting("notifications", v)}>
                Push notifications
            </Switch>
        </div>
    );
}
```

## Do

- Use `Switch` for actions that take effect immediately without a "Save" button.
- Provide a clear, descriptive label via `children`.
- Use `onCheck` when you only need the new boolean value — it avoids parsing `e.target.checked`.
- Use design-token classes on wrapper elements (`bg-background`, `text-foreground`).

## Don't

- Don't use `Switch` for selecting multiple items from a list — use `Checkbox` or `MultiSelect`.
- Don't use `Switch` when the action involves a long or complex process without additional loading feedback.
- Don't pass raw Tailwind color classes (`bg-green-500`, `border-gray-300`) — use design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`) — override CSS variables in your `@theme` block instead.

## Accessibility

- A hidden `<input type="checkbox">` ensures correct native form submission and value reading.
- The visual toggle is a `<button role="switch">` with `aria-checked` reflecting the current state.
- `aria-labelledby` links the button to the rendered label element.
- Space and Enter toggle the switch via the button's `onClick` handler.
- When `loading` or `disabled` is true, both the hidden input and the button receive `disabled`, preventing interaction.

## Data Attributes

| Attribute        | Element                         | Value               | Description                                          |
| ---------------- | ------------------------------- | ------------------- | ---------------------------------------------------- |
| `data-component` | `fieldset`                      | `"switch"`          | Identifies the component.                            |
| `data-checked`   | `input`, `button`, thumb `span` | `"true" \| "false"` | Reflects the checked state for CSS targeting.        |
| `data-trigger`   | `input`                         | `"change"`          | Used internally to track the synthetic change event. |

## Notes

- The component manages its own `innerChecked` state and re-syncs when `props.checked` changes, supporting both controlled and semi-controlled usage patterns.
- A synthetic `change` event is dispatched on the hidden input after toggling, so external form libraries that listen to native events will pick up the change.
- Smooth track and thumb transitions use `duration-300 ease-in-out`.
