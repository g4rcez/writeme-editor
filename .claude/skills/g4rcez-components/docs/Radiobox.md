---
title: Radiobox
description: Styled radio button for selecting one option from a mutually exclusive set.
package: "@g4rcez/components"
export: "{ Radiobox }"
import: "import { Radiobox } from '@g4rcez/components/radiobox'"
category: form
---

# Radiobox

Styled radio button for selecting one option from a mutually exclusive set.

## Import

```tsx
import { Radiobox } from "@g4rcez/components/radiobox";
```

## Props

Accepts all standard HTML `input[type="radio"]` attributes, plus:

| Prop        | Type                  | Default    | Description                                               |
| ----------- | --------------------- | ---------- | --------------------------------------------------------- |
| `children`  | `React.ReactNode`     | —          | Label text or element displayed next to the radio button. |
| `size`      | `"medium" \| "large"` | `"medium"` | Visual size of the radio button.                          |
| `className` | `string`              | —          | Additional CSS classes for the `<input>` element.         |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                 | CSS Variable    | Purpose                                  |
| --------------------- | --------------- | ---------------------------------------- |
| `border-card-border`  | `--card-border` | Default border color of the radio circle |
| `text-primary`        | `--primary`     | Checked fill color (via `accent-color`)  |
| `focus:ring-primary`  | `--primary`     | Focus ring color                         |
| `disabled:opacity-70` | —               | Reduced opacity for disabled state       |

## Examples

### Basic group

```tsx
import { Radiobox } from "@g4rcez/components/radiobox";

export default function PlanSelector() {
    return (
        <div className="flex flex-col gap-sm">
            <Radiobox name="plan" value="basic" defaultChecked>
                Basic Plan
            </Radiobox>
            <Radiobox name="plan" value="pro">
                Pro Plan
            </Radiobox>
            <Radiobox name="plan" value="enterprise">
                Enterprise Plan
            </Radiobox>
        </div>
    );
}
```

### Disabled state

```tsx
import { Radiobox } from "@g4rcez/components/radiobox";

export default function DisabledOption() {
    return (
        <Radiobox disabled name="option" value="legacy">
            Legacy (unavailable)
        </Radiobox>
    );
}
```

### In a grid layout

```tsx
import { Radiobox } from "@g4rcez/components/radiobox";

export default function GenderSelector() {
    return (
        <div className="grid grid-cols-2 gap-base">
            <Radiobox name="gender" value="male">
                Male
            </Radiobox>
            <Radiobox name="gender" value="female">
                Female
            </Radiobox>
            <Radiobox name="gender" value="non-binary">
                Non-binary
            </Radiobox>
            <Radiobox name="gender" value="prefer-not">
                Prefer not to say
            </Radiobox>
        </div>
    );
}
```

## Do

- Group related `Radiobox` components by giving them the same `name` attribute.
- Provide a clear, concise label for each radio button via `children`.
- Use `Radiobox` when there are 2–7 mutually exclusive options; for more, prefer `Select`.
- Use design-token classes on wrapper elements (`bg-background`, `text-foreground`).

## Don't

- Don't use `Radiobox` for independent toggles — use `Checkbox` instead.
- Don't use `Radiobox` for a simple yes/no choice — consider `Switch`.
- Don't pass raw Tailwind color classes (`text-blue-500`, `border-gray-300`) — use design tokens instead.
- Don't use arbitrary Tailwind values (`text-[--my-var]`) — override CSS variables in your `@theme` block instead.

## Accessibility

- A semantic `<label>` wraps the `<input>`, associating label text with the radio button without extra `htmlFor` wiring.
- `aria-disabled` is set on the wrapper `<label>` when the input is disabled.
- Standard keyboard interaction: Arrow keys navigate between radios in the same group; Space selects.
- The `data-[disabled=true]:cursor-not-allowed` class gives a clear cursor signal for disabled items.

## Data Attributes

| Attribute        | Element | Value               | Description                     |
| ---------------- | ------- | ------------------- | ------------------------------- |
| `data-component` | `label` | `"radiobox"`        | Identifies the component.       |
| `data-disabled`  | `label` | `true \| undefined` | Set when the radio is disabled. |

## Notes

- Uses the `form-radio` utility class for consistent cross-browser appearance.
- The `size` prop is accepted in the type definition but visual differentiation is handled via the `className` pass-through — you may add `h-5 w-5` or similar token-based size classes as needed.
- Render multiple `Radiobox` components inside a `<fieldset>` with a `<legend>` for full semantic grouping.
