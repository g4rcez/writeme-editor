---
title: Checkbox
description: Styled checkbox with label support, task mode, error display, loading state, and size variants.
package: "@g4rcez/components"
export: "{ Checkbox }"
import: "import { Checkbox } from '@g4rcez/components/checkbox'"
category: form
---

# Checkbox

Styled checkbox with label support, task mode, error display, loading state, and size variants.

## Import

```tsx
import { Checkbox } from "@g4rcez/components/checkbox";
```

## Props

| Prop             | Type                                               | Default    | Description                                                |
| ---------------- | -------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| `checked`        | `boolean`                                          | -          | Controlled checked state                                   |
| `onChange`       | `(e: React.ChangeEvent<HTMLInputElement>) => void` | -          | Change handler                                             |
| `disabled`       | `boolean`                                          | `false`    | Disabled state                                             |
| `loading`        | `boolean`                                          | `false`    | Loading state — disables the checkbox while loading        |
| `error`          | `string`                                           | -          | Error message rendered below the label                     |
| `asTask`         | `boolean`                                          | `false`    | Task mode: applies strikethrough to the label when checked |
| `size`           | `"medium" \| "large"`                              | `"medium"` | Checkbox size                                              |
| `container`      | `string`                                           | -          | Extra CSS classes for the outer `<label>` wrapper          |
| `labelClassName` | `string`                                           | -          | Extra CSS classes for the error text element               |
| `className`      | `string`                                           | -          | Extra CSS classes for the `<input>` element                |
| `children`       | `React.ReactNode`                                  | -          | Label content                                              |
| `...props`       | `React.InputHTMLAttributes<HTMLInputElement>`      | -          | All standard input attributes                              |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                | CSS Variable    | Purpose                              |
| -------------------- | --------------- | ------------------------------------ |
| `text-primary`       | `--primary`     | Checkbox accent / checked color      |
| `border-card-border` | `--card-border` | Unchecked border color               |
| `text-danger`        | `--danger`      | Error message text color             |
| `text-disabled`      | `--disabled`    | Opacity and cursor on disabled state |
| `focus:ring-primary` | `--primary`     | Focus ring color                     |

## Variants

### Size

| Value      | Description                           |
| ---------- | ------------------------------------- |
| `"medium"` | Default size — 1rem × 1rem (`size-4`) |
| `"large"`  | Larger touch target                   |

### Task mode

When `asTask={true}`, the label text receives a strikethrough style when the checkbox is checked. This is intended for to-do lists and task management UIs.

## Examples

### Basic checkbox

```tsx
const [accepted, setAccepted] = useState(false);

<Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)}>
    I accept the terms and conditions
</Checkbox>;
```

### Checkbox with error

```tsx
const [agreed, setAgreed] = useState(false);
const [error, setError] = useState("");

<Checkbox
    checked={agreed}
    onChange={(e) => {
        setAgreed(e.target.checked);
        if (e.target.checked) setError("");
    }}
    error={error}
>
    I agree to the privacy policy
</Checkbox>;
```

### Task list

```tsx
const [tasks, setTasks] = useState([
    { id: 1, text: "Write release notes", done: false },
    { id: 2, text: "Merge pull request", done: true },
]);

<div className="flex flex-col gap-sm">
    {tasks.map((task) => (
        <Checkbox
            key={task.id}
            checked={task.done}
            onChange={() => setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)))}
            asTask
        >
            {task.text}
        </Checkbox>
    ))}
</div>;
```

### Loading state

```tsx
const [loading, setLoading] = useState(false);
const [subscribed, setSubscribed] = useState(false);

const handleChange = async (checked: boolean) => {
    setLoading(true);
    await updateSubscription(checked);
    setSubscribed(checked);
    setLoading(false);
};

<Checkbox checked={subscribed} onChange={(e) => handleChange(e.target.checked)} loading={loading}>
    Subscribe to newsletter
</Checkbox>;
```

### Notification preferences form

```tsx
function PreferencesForm() {
    const [prefs, setPrefs] = useState({
        email: false,
        push: true,
        sms: false,
    });

    const toggle = (key: keyof typeof prefs) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setPrefs((prev) => ({ ...prev, [key]: e.target.checked }));

    return (
        <form className="flex flex-col gap-sm">
            <Checkbox checked={prefs.email} onChange={toggle("email")}>
                Email notifications
            </Checkbox>
            <Checkbox checked={prefs.push} onChange={toggle("push")}>
                Push notifications
            </Checkbox>
            <Checkbox checked={prefs.sms} onChange={toggle("sms")}>
                SMS notifications
            </Checkbox>
        </form>
    );
}
```

## Do

- Use descriptive, actionable labels so users know exactly what they are agreeing to or enabling.
- Group related checkboxes visually to signal they form a set.
- Use `asTask` for items in a to-do list or task-tracking UI.
- Provide an `error` message when the checkbox is part of required validation (e.g., accepting terms).

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`, `border-gray-300`) — use theme props or design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `bg-[--my-var]`) — override CSS variables in your `@theme` block instead.
- Don't use `Checkbox` to trigger an immediate action — use a `Button` or `Switch` instead.
- Don't use checkboxes for mutually exclusive choices — use `Radiobox` instead.

## Accessibility

- Renders a native `<input type="checkbox">` for full browser and screen reader support.
- The outer `<label>` wraps both the input and the label text, so clicking anywhere on the label toggles the checkbox.
- `aria-disabled` and `data-disabled` are applied when `disabled` or `loading` is true.
- Error messages are rendered as visible text below the label and are discoverable by screen readers.
- Focus ring is visible for keyboard navigation.

## Data Attributes

- `data-component="checkbox"` — on the outer `<label>`.
- `data-task` — reflects the `asTask` prop value.
- `data-disabled` — reflects the effective disabled state (`disabled || loading`).
- `data-name="checkbox-label"` — on the error text `<span>`.

## Notes

- `loading` sets `disabled` on the underlying input. The two states share the same visual treatment.
- The component forwards its ref to the `<input>` element.
- All standard `HTMLInputElement` attributes are forwarded to the native input, so you can use `name`, `value`, `required`, `defaultChecked`, and so on.
