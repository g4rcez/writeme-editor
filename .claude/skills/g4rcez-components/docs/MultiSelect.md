---
title: MultiSelect
description: Dropdown that lets users select multiple options with fuzzy search and tag display.
package: "@g4rcez/components"
export: "{ MultiSelect }"
import: "import { MultiSelect } from '@g4rcez/components'"
category: form
---

# MultiSelect

Dropdown that lets users select multiple options with fuzzy search and tag display.

## Import

```tsx
import { MultiSelect } from "@g4rcez/components";
```

## Props

The `MultiSelect` component inherits all props from `InputField`, plus:

| Prop              | Type                          | Default | Description                                                |
| ----------------- | ----------------------------- | ------- | ---------------------------------------------------------- |
| `options`         | `MultiSelectItemProps[]`      | —       | Array of `{ value, label, Render? }` option objects.       |
| `value`           | `string[]`                    | —       | Controlled selected values.                                |
| `defaultValue`    | `string[]`                    | `[]`    | Initial selected values for uncontrolled usage.            |
| `onChangeOptions` | `(options: string[]) => void` | —       | Called when the selection changes.                         |
| `dynamicOption`   | `boolean`                     | `false` | Allows users to select their search query as a new option. |
| `emptyMessage`    | `Label`                       | —       | Message shown when no options match the search.            |
| `selectedLabel`   | `string`                      | —       | Text shown in the overflow counter (e.g., "selected").     |

### MultiSelectItemProps

Extends `OptionProps` with an optional custom renderer:

| Field    | Type                    | Description                                   |
| -------- | ----------------------- | --------------------------------------------- |
| `value`  | `string`                | Option value.                                 |
| `label`  | `string`                | Option display text.                          |
| `Render` | `React.FC<OptionProps>` | Custom render component for the dropdown row. |
| `hidden` | `boolean`               | Hides the option from the list.               |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                          | CSS Variable            | Purpose                                |
| ------------------------------ | ----------------------- | -------------------------------------- |
| `placeholder-input-mask`       | `--input-mask`          | Placeholder text color                 |
| `placeholder-input-mask-error` | `--input-mask-error`    | Placeholder color in error state       |
| `border-input-border`          | `--input-border`        | Search input bottom border in dropdown |
| `bg-floating-background`       | `--floating-background` | Dropdown panel background              |
| `border-floating-border`       | `--floating-border`     | Dropdown panel border                  |
| `bg-floating-hover`            | `--floating-hover`      | Option row hover/active background     |
| `text-foreground`              | `--foreground`          | Option text color                      |
| `text-input-placeholder`       | `--input-placeholder`   | Placeholder li color                   |
| `text-disabled`                | `--disabled`            | Empty-state text color                 |
| `focus:ring-primary`           | `--primary`             | Keyboard focus ring                    |
| `h-input-height`               | `--input-height`        | Trigger element height (2.5 rem)       |
| `px-input-padding-x`           | `--input-padding-x`     | Horizontal padding                     |
| `py-input-padding-y`           | `--input-padding-y`     | Vertical padding                       |

## Examples

### Basic usage

```tsx
import { MultiSelect } from "@g4rcez/components";

const options = [
    { value: "react", label: "React" },
    { value: "vue", label: "Vue" },
    { value: "angular", label: "Angular" },
];

export default function FrameworkPicker() {
    return <MultiSelect title="Frameworks" options={options} onChangeOptions={(values) => console.log(values)} />;
}
```

### Controlled selection

```tsx
import { useState } from "react";
import { MultiSelect } from "@g4rcez/components";

export default function ControlledMultiSelect() {
    const [selected, setSelected] = useState<string[]>(["react"]);

    return (
        <MultiSelect
            title="Frameworks"
            options={[
                { value: "react", label: "React" },
                { value: "vue", label: "Vue" },
                { value: "angular", label: "Angular" },
            ]}
            value={selected}
            onChangeOptions={setSelected}
        />
    );
}
```

### Custom option rendering

```tsx
import { ShieldIcon } from "@phosphor-icons/react";
import { MultiSelect } from "@g4rcez/components";

const roleOptions = roles.map((r) => ({
    value: r.id,
    label: r.name,
    Render: () => (
        <span className="flex items-center gap-base">
            <ShieldIcon size={14} className="text-primary" />
            {r.name}
        </span>
    ),
}));

export default function RolePicker() {
    return <MultiSelect title="Roles" options={roleOptions} onChangeOptions={(ids) => console.log(ids)} />;
}
```

### Dynamic option creation

```tsx
import { MultiSelect } from "@g4rcez/components";

export default function TagInput() {
    return <MultiSelect title="Tags" dynamicOption options={existingTags} onChangeOptions={(tags) => console.log(tags)} />;
}
```

## Do

- Provide a descriptive `title` to label the trigger.
- Use `dynamicOption` when users may need to add items not in the predefined list.
- Use design-token classes for any wrapper elements (`bg-background`, `border-border`, `text-foreground`).
- Use `theme="<value>"` on nested elements — never hardcode colors in `className`.

## Don't

- Don't use `MultiSelect` when only a single selection is needed — use `Select` or `Autocomplete` instead.
- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`) — use theme props or design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `bg-[--my-var]`) — override CSS variables in your `@theme` block instead.
- Don't use `color-mix()` in className or style props for theming.

## Accessibility

- The trigger uses `aria-autocomplete="list"` and `role="button"`.
- The dropdown list uses `role="listbox"` with individual items carrying `role="option"`, `aria-selected`, `aria-checked`, and `aria-current`.
- `FloatingFocusManager` traps focus inside the open dropdown.
- Arrow keys navigate the virtual list; Escape closes it; Enter selects the focused item.

## Data Attributes

| Attribute        | Element       | Value            | Description                                 |
| ---------------- | ------------- | ---------------- | ------------------------------------------- |
| `data-component` | trigger `ul`  | `"autocomplete"` | Identifies the component type.              |
| `data-shadow`    | trigger `ul`  | `"true"`         | Marks the visual shadow trigger.            |
| `data-value`     | trigger `ul`  | JSON string      | Currently selected values as a JSON array.  |
| `data-floating`  | dropdown root | `"true"`         | Marks the floating panel.                   |
| `data-dynamic`   | option button | `"true"`         | Marks options injected via `dynamicOption`. |
| `data-error`     | trigger `ul`  | boolean string   | Reflects the error state.                   |

## Notes

- Uses `react-virtuoso` for virtualized rendering — large option lists perform well.
- The overflow control collapses selected tags into a counter badge when they exceed the trigger width.
- The hidden `<input type="hidden">` stores the comma-separated selected values for native form submission.
- Floating position is computed with `@floating-ui/react` and updates automatically while open (`autoUpdate`).
- The dropdown search uses `fzf` (fuzzy matching) across both `value` and `label` fields.
