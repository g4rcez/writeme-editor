---
title: Select
description: Styled native select component with validation, loading state, and form integration.
package: "@g4rcez/components"
export: "{ Select }"
import: "import { Select } from '@g4rcez/components/select'"
category: form
---

# Select

Styled native select component with validation, loading state, and form integration.

## Import

```tsx
import { Select } from "@g4rcez/components/select";
```

## Props

| Prop                 | Type                                          | Default | Description                                                  |
| -------------------- | --------------------------------------------- | ------- | ------------------------------------------------------------ |
| `options`            | `OptionProps[]`                               | —       | Array of option objects.                                     |
| `selectContainer`    | `string`                                      | `""`    | Additional CSS classes for the select container.             |
| `required`           | `boolean`                                     | `true`  | Whether the field is required.                               |
| `error`              | `string`                                      | —       | Error message to display.                                    |
| `loading`            | `boolean`                                     | `false` | Shows a loading indicator and disables the field.            |
| `disabled`           | `boolean`                                     | `false` | Disables the select.                                         |
| `placeholder`        | `string`                                      | —       | Placeholder shown as a disabled hidden option.               |
| `value`              | `string`                                      | —       | Controlled selected value.                                   |
| `onChange`           | `(e: ChangeEvent<HTMLSelectElement>) => void` | —       | Change handler.                                              |
| `...inputFieldProps` | `InputFieldProps`                             | —       | All `InputField` props (title, left, right, feedback, etc.). |

### OptionProps

| Prop           | Type      | Description                                             |
| -------------- | --------- | ------------------------------------------------------- |
| `value`        | `string`  | Option value (required).                                |
| `label`        | `string`  | Display text (falls back to `value` if omitted).        |
| `disabled`     | `boolean` | Disables this individual option.                        |
| `data-dynamic` | `string`  | Marks a dynamically generated option.                   |
| `data-*`       | `string`  | Any custom data attributes forwarded to the `<option>`. |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                                     | CSS Variable          | Purpose                          |
| ----------------------------------------- | --------------------- | -------------------------------- |
| `text-foreground`                         | `--foreground`        | Selected option text color       |
| `text-input-placeholder`                  | `--input-placeholder` | Color when no option is selected |
| `placeholder-input-placeholder`           | `--input-placeholder` | Placeholder styling              |
| `bg-input-mask-error` (via `group-error`) | `--input-mask-error`  | Placeholder tint in error state  |
| `text-danger` (via `group-error`)         | `--danger`            | Text color in error state        |
| `hover:text-primary`                      | `--primary`           | Caret icon hover color           |
| `h-input-height`                          | `--input-height`      | Control height (2.5 rem)         |
| `px-input-padding-x`                      | `--input-padding-x`   | Horizontal padding               |
| `py-input-padding-y`                      | `--input-padding-y`   | Vertical padding                 |

## Examples

### Basic usage

```tsx
import { useState } from "react";
import { Select } from "@g4rcez/components/select";

export default function FruitPicker() {
    const [value, setValue] = useState("");

    return (
        <Select
            title="Fruit"
            options={[
                { value: "apple", label: "Apple" },
                { value: "banana", label: "Banana" },
                { value: "orange", label: "Orange" },
            ]}
            placeholder="Select a fruit"
            value={value}
            onChange={(e) => setValue(e.target.value)}
        />
    );
}
```

### With validation error

```tsx
import { useState } from "react";
import { Select } from "@g4rcez/components/select";

export default function CountrySelect() {
    const [country, setCountry] = useState("");
    const [error, setError] = useState("");

    return (
        <Select
            title="Country"
            options={[
                { value: "us", label: "United States" },
                { value: "ca", label: "Canada" },
                { value: "uk", label: "United Kingdom" },
            ]}
            placeholder="Select country"
            value={country}
            error={error}
            required
            onChange={(e) => {
                setCountry(e.target.value);
                setError(e.target.value ? "" : "Please select a country");
            }}
        />
    );
}
```

### With disabled options

```tsx
import { Select } from "@g4rcez/components/select";

export default function StatusSelect() {
    return (
        <Select
            title="Status"
            options={[
                { value: "active", label: "Active" },
                { value: "pending", label: "Pending" },
                { value: "legacy", label: "Legacy (deprecated)", disabled: true },
                { value: "inactive", label: "Inactive" },
            ]}
            placeholder="Select status"
        />
    );
}
```

### Async options with loading state

```tsx
import { useEffect, useState } from "react";
import { Select } from "@g4rcez/components/select";

export default function AsyncSelect() {
    const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [value, setValue] = useState("");

    useEffect(() => {
        setLoading(true);
        fetchOptions().then((data) => {
            setOptions(data);
            setLoading(false);
        });
    }, []);

    return (
        <Select
            title="Region"
            options={options}
            placeholder={loading ? "Loading..." : "Select a region"}
            value={value}
            loading={loading}
            disabled={loading}
            onChange={(e) => setValue(e.target.value)}
        />
    );
}
```

### Form integration with `useForm`

```tsx
import { Select } from "@g4rcez/components/select";
import { useForm } from "@g4rcez/components/form";

export default function UserForm() {
    const form = useForm(schema, "userForm");

    return (
        <form {...form.props}>
            <Select
                {...form.select("role")}
                options={[
                    { value: "admin", label: "Administrator" },
                    { value: "editor", label: "Editor" },
                    { value: "viewer", label: "Viewer" },
                ]}
                placeholder="Select role"
            />
        </form>
    );
}
```

### Cascading selects

```tsx
import { useState } from "react";
import { Select } from "@g4rcez/components/select";

const subcategories: Record<string, { value: string; label: string }[]> = {
    electronics: [
        { value: "phones", label: "Phones" },
        { value: "laptops", label: "Laptops" },
    ],
    clothing: [
        { value: "shirts", label: "Shirts" },
        { value: "pants", label: "Pants" },
    ],
};

export default function CascadingSelect() {
    const [category, setCategory] = useState("");
    const [subcategory, setSubcategory] = useState("");

    return (
        <div className="flex flex-col gap-base">
            <Select
                title="Category"
                options={[
                    { value: "electronics", label: "Electronics" },
                    { value: "clothing", label: "Clothing" },
                ]}
                placeholder="Select category"
                value={category}
                onChange={(e) => {
                    setCategory(e.target.value);
                    setSubcategory("");
                }}
            />

            {category && (
                <Select
                    title="Subcategory"
                    options={subcategories[category] ?? []}
                    placeholder="Select subcategory"
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                />
            )}
        </div>
    );
}
```

## Do

- Use descriptive `label` values for each option.
- Order options logically (alphabetically or by usage frequency).
- Provide a `placeholder` so users know what to select.
- Use `loading` and `disabled` together while fetching options asynchronously.
- Use design-token classes for wrapper elements (`bg-background`, `text-foreground`, `border-border`).

## Don't

- Don't use `Select` for only 2–3 options — prefer `Radiobox` or `Switch` for better visibility.
- Don't use `Select` for large searchable lists — use `Autocomplete` instead.
- Don't use long option labels that may truncate on small viewports.
- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`, `border-gray-300`) — use design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `bg-[--my-var]`) — override CSS variables in your `@theme` block instead.

## Accessibility

- Uses a native `<select>` element for full keyboard support and screen-reader compatibility.
- The `placeholder` renders as a `disabled hidden` option so it is never submitted.
- A `CaretDownIcon` caret is rendered inside a `<label>` pointing to the select id, giving it a larger click target.
- `data-selected` is set to `"false"` until the user selects an option, which toggles the placeholder color class.

## Data Attributes

| Attribute        | Element           | Value               | Description                                   |
| ---------------- | ----------------- | ------------------- | --------------------------------------------- |
| `data-component` | `InputField` root | `"select"`          | Identifies the component.                     |
| `data-selected`  | `<select>`        | `"true" \| "false"` | Whether a non-placeholder option is selected. |

## Notes

- Built on `InputField` for layout, label, error, and loading handling.
- Supports all standard HTML `<select>` attributes via prop spread.
- `required` defaults to `true` — pass `required={false}` when the field is optional.
- Custom data attributes on `OptionProps` (e.g., `data-price`) are forwarded to each `<option>` and accessible via `e.target.selectedOptions[0].dataset`.
