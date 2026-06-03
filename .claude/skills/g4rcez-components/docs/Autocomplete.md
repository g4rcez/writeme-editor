---
title: Autocomplete
description: Searchable select with fuzzy matching, virtualized options, keyboard navigation, and dynamic option creation.
package: "@g4rcez/components"
export: "{ Autocomplete }"
import: "import { Autocomplete } from '@g4rcez/components/autocomplete'"
category: form
---

# Autocomplete

Searchable select with fuzzy matching, virtualized options, keyboard navigation, and dynamic option creation.

## Import

```tsx
import { Autocomplete } from "@g4rcez/components/autocomplete";
```

## Props

| Prop             | Type                                               | Default | Description                                           |
| ---------------- | -------------------------------------------------- | ------- | ----------------------------------------------------- |
| `title`          | `string`                                           | -       | Field label                                           |
| `value`          | `string`                                           | -       | Controlled selected value                             |
| `options`        | `AutocompleteItemProps[]`                          | -       | List of selectable options                            |
| `emptyMessage`   | `Label`                                            | -       | Message displayed when no options match               |
| `dynamicOption`  | `boolean`                                          | `false` | Allow creating new options from typed text            |
| `onChange`       | `(e: React.ChangeEvent<HTMLInputElement>) => void` | -       | Change handler                                        |
| `error`          | `string`                                           | -       | Error message displayed below the field               |
| `feedback`       | `Label`                                            | -       | Success/neutral feedback text below the field         |
| `left`           | `Label`                                            | -       | Content rendered on the left inside the field border  |
| `right`          | `Label`                                            | -       | Content rendered on the right inside the field border |
| `required`       | `boolean`                                          | `false` | Marks field as required; hides "Optional" text        |
| `disabled`       | `boolean`                                          | `false` | Disables the field                                    |
| `loading`        | `boolean`                                          | `false` | Shows loading state                                   |
| `container`      | `string`                                           | -       | Extra CSS classes for the outer `fieldset`            |
| `labelClassName` | `string`                                           | -       | Extra CSS classes for the label/border wrapper        |

### AutocompleteItemProps

```tsx
type AutocompleteItemProps = {
    value: string;
    label?: string;
    hidden?: boolean;
    disabled?: boolean;
    "data-dynamic"?: string;
    Render?: React.FC<OptionProps>;
} & Record<`data-${string}`, string>;
```

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                          | CSS Variable            | Purpose                                   |
| ------------------------------ | ----------------------- | ----------------------------------------- |
| `h-input-height`               | `--input-height`        | Input height                              |
| `px-input-padding-x`           | `--input-padding-x`     | Horizontal input padding                  |
| `py-input-padding-y`           | `--input-padding-y`     | Vertical input padding                    |
| `border-input-border`          | `--input-border`        | Default field border color                |
| `placeholder-input-mask`       | `--input-mask`          | Placeholder text color                    |
| `placeholder-input-mask-error` | `--input-mask-error`    | Placeholder color in error state          |
| `text-foreground`              | `--foreground`          | Input text color                          |
| `text-danger`                  | `--danger`              | Text color in error state                 |
| `text-primary`                 | `--primary`             | Focus/hover border and ring color         |
| `bg-floating-background`       | `--floating-background` | Dropdown background                       |
| `border-floating-border`       | `--floating-border`     | Dropdown border color                     |
| `bg-floating-hover`            | `--floating-hover`      | Option background on hover/keyboard focus |
| `text-disabled`                | `--disabled`            | Empty message text color                  |
| `border-tooltip-border`        | `--tooltip-border`      | Separator inside dropdown                 |
| `z-floating`                   | `--z-floating`          | Z-index for the floating panel            |
| `shadow-floating`              | `--shadow-floating`     | Drop shadow for the floating panel        |

## Examples

### Basic usage

```tsx
import { Autocomplete } from "@g4rcez/components/autocomplete";

const options = [
    { value: "react", label: "React" },
    { value: "vue", label: "Vue" },
    { value: "svelte", label: "Svelte" },
];

function FrameworkPicker() {
    const [value, setValue] = useState("");

    return (
        <Autocomplete
            title="Framework"
            placeholder="Search frameworks..."
            options={options}
            value={value}
            onChange={(e) => setValue(e.target.value)}
        />
    );
}
```

### Dynamic option creation

```tsx
function TagPicker() {
    const [value, setValue] = useState("");
    const [tags, setTags] = useState([
        { value: "typescript", label: "TypeScript" },
        { value: "javascript", label: "JavaScript" },
    ]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value;
        setValue(next);
        if (next && !tags.find((t) => t.value === next)) {
            setTags((prev) => [...prev, { value: next, label: next }]);
        }
    };

    return (
        <Autocomplete
            title="Tag"
            placeholder="Search or create a tag..."
            options={tags}
            value={value}
            onChange={handleChange}
            dynamicOption
            emptyMessage="Type to create a new tag"
        />
    );
}
```

### Custom option renderer

```tsx
type UserOption = AutocompleteItemProps & { email: string; role: string };

const UserRow = ({ value, label, ...props }: UserOption) => (
    <div className="flex flex-col gap-0.5 py-1">
        <span className="font-medium text-sm text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{props.email}</span>
    </div>
);

const users: UserOption[] = [
    { value: "alice", label: "Alice", email: "alice@example.com", role: "admin", Render: UserRow },
    { value: "bob", label: "Bob", email: "bob@example.com", role: "member", Render: UserRow },
];

<Autocomplete title="Assign to" options={users} value="" onChange={() => {}} />;
```

### Form integration

```tsx
import { Form } from "@g4rcez/components/form";
import { Button } from "@g4rcez/components/button";

const countries = [
    { value: "br", label: "Brazil" },
    { value: "us", label: "United States" },
    { value: "de", label: "Germany" },
];

function ContactForm() {
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        const data = new FormData(e.currentTarget);
        console.log(Object.fromEntries(data));
    };

    return (
        <Form onSubmit={handleSubmit} className="flex flex-col gap-base">
            <Autocomplete name="country" title="Country" options={countries} required emptyMessage="No countries found" />
            <Button theme="primary" type="submit">
                Submit
            </Button>
        </Form>
    );
}
```

## Do

- Provide a meaningful `emptyMessage` so users understand why no results appear.
- Use `dynamicOption` when users should be able to add values not in the list.
- Supply a custom `Render` component when each option needs to show more than its label (e.g., avatars, secondary text).
- Prefer `Autocomplete` over `Select` for lists of more than ~15 items.

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`, `border-gray-300`) — use theme props or design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `bg-[--my-var]`) — override CSS variables in your `@theme` block instead.
- Don't use `Autocomplete` for small lists where `Select` is simpler and faster.
- Don't forget to handle the unselected case when `dynamicOption` is off and the user types but never picks an option.

## Accessibility

- Renders a `role="listbox"` dropdown managed by `@floating-ui/react`.
- The visible input carries `aria-autocomplete="list"`.
- Each option button has `aria-selected`, `aria-current`, and `aria-checked` set to reflect the active state.
- Full keyboard navigation: Arrow Up/Down to move, Enter to select, Escape to close.
- The caret button includes an `sr-only` label from the translation system.
- Focus is returned to the trigger input when the dropdown closes.

## Data Attributes

- `data-value` — on the hidden `<input>`: the committed option value.
- `data-shadow="true"` — on the visible text input to distinguish it from the real field.
- `data-dynamic="true"` — on options injected by `dynamicOption`.
- `data-initialized` — managed internally; used by `formReset` to track interaction state.
- `data-floating="true"` — on the floating panel element.

## Notes

- The component renders two `<input>` elements: a visible shadow input for display/search and a hidden input with `name` that participates in form submission.
- Option filtering uses a fuzzy-search (`fzf`) algorithm that matches partial text, abbreviations, and out-of-order characters against both `value` and `label`.
- Large option lists are virtualized via `react-virtuoso` — rendering performance is maintained even with thousands of options.
- The dropdown width always matches the width of the triggering fieldset.
