---
title: InputField
description: Low-level field wrapper that provides a label, tooltip, error message, feedback text, and left/right slots for any form control.
package: "@g4rcez/components"
export: "{ InputField }"
import: "import { InputField } from '@g4rcez/components'"
category: form
---

# InputField

Low-level field wrapper that provides a label, tooltip, error message, feedback text, and left/right slots for any form control. Most higher-level components (`Input`, `Select`, `Autocomplete`, `DatePicker`, `Textarea`) use `InputField` internally and forward its props automatically.

## Import

```tsx
import { InputField } from "@g4rcez/components";
```

## Props

| Prop             | Type              | Default      | Description                                                              |
| ---------------- | ----------------- | ------------ | ------------------------------------------------------------------------ |
| `title`          | `Label`           | -            | Main label text for the field                                            |
| `info`           | `Label`           | -            | Informational text shown in a `Tooltip` icon next to the label           |
| `error`          | `string`          | -            | Error message rendered below the field border                            |
| `feedback`       | `Label`           | -            | Success or neutral feedback message (hidden when `error` is present)     |
| `left`           | `Label`           | -            | Content rendered to the left inside the field border                     |
| `right`          | `Label`           | -            | Content rendered to the right inside the field border                    |
| `rightLabel`     | `Label`           | -            | Content rendered to the right of the label text                          |
| `required`       | `boolean`         | `false`      | If `true`, hides the "Optional" badge                                    |
| `optionalText`   | `string`          | `"Optional"` | Text shown for optional fields (translatable)                            |
| `disabled`       | `boolean`         | `false`      | Applies disabled styling to the wrapper and label                        |
| `interactive`    | `boolean`         | `false`      | Sets `data-interactive` on the fieldset                                  |
| `container`      | `string`          | -            | Extra CSS classes for the outer `<fieldset>`                             |
| `labelClassName` | `string`          | -            | Extra CSS classes for the inner label/border wrapper `<div>`             |
| `hiddenLabel`    | `boolean`         | `false`      | Visually hides the label row while keeping it accessible                 |
| `reportStatus`   | `boolean`         | -            | Show `CheckCircle`/`XCircle` icons alongside the label based on validity |
| `componentName`  | `string`          | -            | Sets `data-component` on the fieldset (e.g., `"input"`, `"select"`)      |
| `id`             | `string`          | -            | `id` linked to the inner control via `htmlFor` on the label              |
| `name`           | `string`          | -            | Fallback for `id` when `id` is not provided                              |
| `children`       | `React.ReactNode` | -            | The actual form control (input, select, etc.)                            |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                   | CSS Variable         | Purpose                                            |
| ----------------------- | -------------------- | -------------------------------------------------- |
| `border-input-border`   | `--input-border`     | Default field border color                         |
| `text-input-label-text` | `--input-label-text` | Label text color                                   |
| `text-primary`          | `--primary`          | Label and border color on focus/hover              |
| `text-danger`           | `--danger`           | Label, border, and error text color in error state |
| `text-disabled`         | `--disabled`         | Label and border color when disabled               |
| `mt-input-gap`          | `--input-gap`        | Gap between border and error/feedback text         |

## Examples

### Wrapping a native input

```tsx
import { InputField } from "@g4rcez/components";

<InputField title="Username" name="username" required>
    <input id="username" name="username" className="h-input-height w-full flex-1 bg-transparent px-input-padding-x text-foreground outline-none" />
</InputField>;
```

### With info tooltip and error

```tsx
import { MagnifyingGlassIcon, CheckIcon } from "@phosphor-icons/react";

<InputField
    title="API Key"
    name="api_key"
    info="Your secret API key from the developer portal."
    error={apiKeyError}
    left={<MagnifyingGlassIcon size={16} className="text-muted-foreground" />}
    right={isValid ? <CheckIcon size={16} className="text-success" /> : null}
    required
>
    <input
        id="api_key"
        name="api_key"
        type="password"
        className="h-input-height w-full flex-1 bg-transparent px-input-padding-x text-foreground outline-none"
    />
</InputField>;
```

### Optional vs required

```tsx
{
    /* Required — "Optional" badge is hidden */
}
<InputField title="Email" name="email" required>
    <input
        id="email"
        name="email"
        type="email"
        className="h-input-height w-full flex-1 bg-transparent px-input-padding-x text-foreground outline-none"
    />
</InputField>;

{
    /* Optional — shows "Optional" badge */
}
<InputField title="Website" name="website">
    <input
        id="website"
        name="website"
        type="url"
        className="h-input-height w-full flex-1 bg-transparent px-input-padding-x text-foreground outline-none"
    />
</InputField>;
```

### Hidden label (accessible)

```tsx
<InputField title="Search" name="search" hiddenLabel>
    <input
        id="search"
        name="search"
        placeholder="Search..."
        className="h-input-height w-full flex-1 bg-transparent px-input-padding-x text-foreground outline-none"
    />
</InputField>
```

### Feedback after validation

```tsx
<InputField
    title="Slug"
    name="slug"
    feedback={isAvailable ? "This slug is available." : undefined}
    error={!isAvailable ? "Slug is already taken." : undefined}
    required
>
    <input id="slug" name="slug" className="h-input-height w-full flex-1 bg-transparent px-input-padding-x text-foreground outline-none" />
</InputField>
```

## Do

- Use `InputField` when building new form controls to ensure consistent label, error, and feedback layout across the application.
- Always provide a `title` for every field so screen readers can identify the control.
- Use the `info` prop for fields that need supplemental explanation without cluttering the label.
- Match the `id` on the inner control to the `name` (or `id`) on `InputField` so the `<label htmlFor>` association works correctly.

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`, `border-gray-300`) to `InputField` wrappers — use theme props or design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `bg-[--my-var]`) — override CSS variables in your `@theme` block instead.
- Don't use `InputField` for non-form content; it is specifically designed for labeled input controls.
- Don't skip the `title` prop — omitting it hides the label but may break screen reader associations.

## Accessibility

- Renders a `<fieldset>` element as the outer wrapper, with `aria-disabled` when disabled.
- The inner `<label>` uses `htmlFor` linked to `id` (or `name`) to associate with the control.
- Error messages render as a `<p>` below the field; they are shown after the user interacts with the input (`data-initialized="true"`) or when `error` is set explicitly.
- Feedback messages render as a separate `<p>` and are hidden when an error is present.
- The `info` tooltip uses `Tooltip` with `aria-label` / `aria-describedby` for screen reader support.
- `reportStatus` icons use `aria-hidden="true"` since they are supplemental visual indicators.

## Data Attributes

- `data-component` — reflects the `componentName` prop (e.g., `"input"`, `"select"`, `"autocomplete"`).
- `data-error` — `"true"` when an `error` string is present; drives CSS group variants.
- `data-interactive` — `"true"` when `interactive` is set; used for custom interactive state styling.

## Notes

- `InputField` uses Tailwind `group` classes to synchronize hover and focus states between the outer wrapper and inner elements. The `group-focus-within:border-primary` and `group-hover:border-primary` patterns rely on this.
- The optional text label ("Optional") is sourced from the translation system via `useTranslations`, making it localizable.
- `reportStatus` defaults to the value configured in `useTweaks().input.iconFeedback`, allowing a global default.
