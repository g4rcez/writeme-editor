---
title: Textarea
description: Auto-growing multi-line text input built on the InputField foundation.
package: "@g4rcez/components"
export: "{ Textarea }"
import: "import { Textarea } from '@g4rcez/components'"
category: form
---

# Textarea

Auto-growing multi-line text input built on the InputField foundation.

## Import

```tsx
import { Textarea } from "@g4rcez/components";
```

## Props

Inherits all `InputField` props and standard HTML `<textarea>` attributes, plus:

| Prop          | Type      | Default | Description                                                                             |
| ------------- | --------- | ------- | --------------------------------------------------------------------------------------- |
| `title`       | `Label`   | —       | Label for the textarea.                                                                 |
| `error`       | `string`  | —       | Error message displayed below the field.                                                |
| `loading`     | `boolean` | `false` | Disables the field and signals a pending state.                                         |
| `rows`        | `number`  | `2`     | Initial number of visible text rows.                                                    |
| `next`        | `string`  | —       | ID of the next element to focus when Enter is pressed (requires `enterKeyHint="next"`). |
| `placeholder` | `string`  | —       | Placeholder text.                                                                       |
| `required`    | `boolean` | —       | Marks the field as required.                                                            |
| `className`   | `string`  | —       | Additional CSS classes for the `<textarea>` element.                                    |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                                              | CSS Variable         | Purpose                                              |
| -------------------------------------------------- | -------------------- | ---------------------------------------------------- |
| `placeholder-input-mask`                           | `--input-mask`       | Placeholder text color                               |
| `placeholder-input-mask-error` (via `group-error`) | `--input-mask-error` | Placeholder tint in error state                      |
| `text-foreground`                                  | `--foreground`       | Input text color                                     |
| `text-danger` (via `group-error`)                  | `--danger`           | Text color in error state                            |
| `bg-transparent`                                   | —                    | Input background (inherits from field wrapper)       |
| `focus:ring-primary`                               | `--primary`          | Focus ring                                           |
| `group-focus-within:border-primary`                | `--primary`          | Border highlight on focus                            |
| `group-hover:border-primary`                       | `--primary`          | Border highlight on hover                            |
| `h-input-height`                                   | `--input-height`     | Base height token (overridden by `rows` in practice) |
| `px-input-padding-x`                               | `--input-padding-x`  | Horizontal padding                                   |
| `py-input-padding-y`                               | `--input-padding-y`  | Vertical padding                                     |

## Examples

### Basic usage

```tsx
import { Textarea } from "@g4rcez/components";

export default function BioField() {
    return <Textarea title="Bio" name="bio" placeholder="Tell us about yourself…" rows={4} onChange={(e) => console.log(e.target.value)} />;
}
```

### With validation error

```tsx
import { Textarea } from "@g4rcez/components";

export default function MessageField() {
    return (
        <Textarea
            title="Message"
            name="message"
            required
            error="Message is required and must be at least 10 characters."
            placeholder="Enter your message…"
        />
    );
}
```

### Monospace styling for code

```tsx
import { Textarea } from "@g4rcez/components";

export default function CssSnippetField() {
    return <Textarea title="CSS Snippet" name="css" className="font-mono text-sm" rows={6} placeholder="body { margin: 0; }" />;
}
```

### Focus-next navigation

```tsx
import { Textarea } from "@g4rcez/components";
import { Input } from "@g4rcez/components";

export default function MultiFieldForm() {
    return (
        <div className="flex flex-col gap-base">
            <Textarea title="Description" name="description" enterKeyHint="next" next="submit-btn" rows={3} placeholder="Describe the issue…" />
            <button id="submit-btn" type="submit" className="btn">
                Submit
            </button>
        </div>
    );
}
```

## Do

- Provide a descriptive `title` to label the field.
- Set a sensible initial `rows` value based on the expected content length.
- Use `Textarea` whenever the user is expected to provide more than a single line of text.
- Use design-token classes on wrapper elements (`bg-background`, `text-foreground`, `border-border`).

## Don't

- Don't use `Textarea` for single-line inputs like names or emails — use `Input` instead.
- Don't fix the height with a `className` like `h-32` if you want the auto-resize behavior to work.
- Don't pass raw Tailwind color classes (`bg-gray-50`, `border-gray-300`) — use design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`) — override CSS variables in your `@theme` block instead.

## Accessibility

- Rendered inside an `InputField` which wraps the element with `<fieldset>` and a `<label>` linked via `id`/`for`.
- Supports `aria-required`, `aria-invalid`, `aria-disabled`, and `aria-readonly` via prop spread.
- Keyboard navigation follows standard `<textarea>` behavior (Tab to focus, Shift+Tab to leave).
- When `enterKeyHint="next"` and a `next` id is provided, pressing Enter moves focus to the target element.

## Data Attributes

| Attribute        | Element           | Value         | Description                                       |
| ---------------- | ----------------- | ------------- | ------------------------------------------------- |
| `data-component` | `InputField` root | `"textarea"`  | Identifies the component.                         |
| `data-error`     | `InputField` root | truthy string | Present when an error message is supplied.        |
| `data-next`      | `<textarea>`      | element id    | Target element id for Enter-key focus forwarding. |

## Notes

- Auto-resize is driven by a native `input` event listener that sets `style.height = "auto"` then `style.height = scrollHeight + "px"` — no JavaScript polling or ResizeObserver involved.
- The resize handle is set to `resize-y` by default; add `className="resize-none"` to disable it.
- Built via the shared `createFreeText` factory, which also powers the `Input` component — all `InputField` layout features (left/right slots, optional text, feedback, etc.) are available.
