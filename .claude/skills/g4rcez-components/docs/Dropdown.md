---
title: Dropdown
description: Floating dropdown panel with an optional title, arrow pointer, and automatic collision-aware positioning.
package: "@g4rcez/components"
export: "{ Dropdown }"
import: "import { Dropdown } from '@g4rcez/components/dropdown'"
category: floating
---

# Dropdown

Floating dropdown panel with an optional title, arrow pointer, and automatic collision-aware positioning.

## Import

```tsx
import { Dropdown } from "@g4rcez/components/dropdown";
```

## Props

| Prop           | Type                                    | Default | Description                                          |
| -------------- | --------------------------------------- | ------- | ---------------------------------------------------- |
| `trigger`      | `React.ReactElement \| React.ReactNode` | —       | Element that toggles the dropdown on click           |
| `open`         | `boolean`                               | —       | Controlled open state                                |
| `arrow`        | `boolean`                               | `false` | Show an arrow pointer pointing at the trigger        |
| `title`        | `React.ReactNode \| string`             | —       | Header title rendered inside the panel               |
| `restoreFocus` | `boolean`                               | `true`  | Restore focus to the trigger when the panel closes   |
| `returnFocus`  | `boolean`                               | `true`  | Return focus to the trigger element                  |
| `onChange`     | `(nextValue: boolean) => void`          | —       | Callback fired when the open state changes           |
| `buttonProps`  | `React.HTMLProps<"button">`             | —       | Additional props forwarded to the trigger `<button>` |
| `children`     | `React.ReactNode`                       | —       | Panel content                                        |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                      | CSS Variable            | Purpose                        |
| -------------------------- | ----------------------- | ------------------------------ |
| `bg-floating-background`   | `--floating-background` | Panel surface background       |
| `border-floating-border`   | `--floating-border`     | Panel border and arrow stroke  |
| `fill-floating-background` | `--floating-background` | Arrow fill color               |
| `z-floating`               | `--z-floating`          | Z-index for the floating panel |
| `shadow-shadow-floating`   | `--shadow-floating`     | Panel drop shadow              |
| `rounded-lg`               | —                       | Panel corner radius            |

## Examples

### Simple Action Menu

```tsx
import { Dropdown } from "@g4rcez/components/dropdown";
import { Button } from "@g4rcez/components/button";

function SimpleDropdown() {
    return (
        <Dropdown trigger={<Button theme="primary">Actions</Button>}>
            <div className="flex min-w-48 flex-col py-1">
                <button className="w-full px-4 py-2 text-left text-foreground hover:bg-floating-hover">Edit</button>
                <button className="w-full px-4 py-2 text-left text-foreground hover:bg-floating-hover">Duplicate</button>
                <hr className="border-border my-1" />
                <button className="w-full px-4 py-2 text-left text-danger hover:bg-floating-hover">Delete</button>
            </div>
        </Dropdown>
    );
}
```

### Dropdown with Title and Arrow

```tsx
import { UserIcon, CaretDownIcon } from "@phosphor-icons/react";
import { Dropdown } from "@g4rcez/components/dropdown";

function AccountDropdown() {
    return (
        <Dropdown
            trigger={
                <button className="flex items-center gap-2 px-3 py-2 rounded-button-radius border border-border text-foreground">
                    <UserIcon size={16} />
                    Account
                    <CaretDownIcon size={16} />
                </button>
            }
            title="Account Options"
            arrow
        >
            <div className="flex min-w-48 flex-col py-1">
                <button className="w-full px-4 py-2 text-left text-foreground hover:bg-floating-hover">Profile Settings</button>
                <button className="w-full px-4 py-2 text-left text-foreground hover:bg-floating-hover">Billing</button>
                <button className="w-full px-4 py-2 text-left text-foreground hover:bg-floating-hover">Sign Out</button>
            </div>
        </Dropdown>
    );
}
```

### Controlled Dropdown

```tsx
import { useState } from "react";
import { Dropdown } from "@g4rcez/components/dropdown";

function ControlledDropdown() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Dropdown
            trigger={<button className="px-4 py-2 rounded-button-radius bg-muted text-foreground">{isOpen ? "Close" : "Open"} Menu</button>}
            open={isOpen}
            onChange={setIsOpen}
        >
            <div className="min-w-48 p-4">
                <p className="text-foreground">Controlled dropdown content</p>
                <button onClick={() => setIsOpen(false)} className="mt-2 px-3 py-1 bg-primary text-primary-foreground rounded-button-radius text-sm">
                    Close
                </button>
            </div>
        </Dropdown>
    );
}
```

### Filter Dropdown with Form Content

```tsx
import { FunnelIcon } from "@phosphor-icons/react";
import { Dropdown } from "@g4rcez/components/dropdown";

function FilterDropdown() {
    const [status, setStatus] = useState("");

    return (
        <Dropdown
            trigger={
                <button className="flex items-center gap-2 px-3 py-2 rounded-button-radius border border-border text-foreground">
                    <FunnelIcon size={16} />
                    Filters
                    {status && <span className="h-2 w-2 rounded-full bg-primary" />}
                </button>
            }
            title="Filter Options"
        >
            <div className="min-w-64 space-y-4 p-4">
                <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full px-3 py-2 rounded-button-radius border border-border bg-background text-foreground"
                    >
                        <option value="">All</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
                <div className="flex gap-2 pt-2">
                    <button onClick={() => setStatus("")} className="px-3 py-1 text-sm rounded-button-radius border border-border text-foreground">
                        Clear
                    </button>
                    <button className="px-3 py-1 text-sm rounded-button-radius bg-primary text-primary-foreground">Apply</button>
                </div>
            </div>
        </Dropdown>
    );
}
```

## Do

- Use design-token classes for dropdown item hover states (`hover:bg-floating-hover`, `text-foreground`) instead of raw color utilities.
- Provide a `title` to help users understand the panel's context.
- Use the `arrow` prop when the trigger is small and spatial context helps the user.
- Group related items with separators for panels with more than 5 items.

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`, `hover:bg-gray-100`) — use design-token classes.
- Don't use arbitrary values (`bg-[#abc]`, `z-[9999]`) — override CSS variables in your `@theme` block.
- Don't put more than 10–15 items in a single dropdown; consider `CommandPalette` or `Modal` instead.
- Don't place critical destructive actions in a dropdown without a confirmation step.

## Accessibility

- The trigger is wrapped in a `<button>` element; pass `aria-label` via `buttonProps` when the trigger has no visible text.
- The panel receives `aria-labelledby` pointing at the heading generated from `title`.
- `FloatingFocusManager` traps focus within the panel and restores it to the trigger on close.
- Clicking outside or pressing `Escape` closes the panel (handled by `useDismiss`).
- Tab navigation works naturally within the panel content.

## Notes

- Built on `@floating-ui/react` with `flip`, `shift`, and `offset(10)` middleware. The panel flips to the opposite side if there is insufficient space.
- When a child element has `data-floating="true"`, focus leaving to that element will not close the dropdown — useful for nested portals.
- The `open` prop is synced to local state via `useEffect`; controlled and uncontrolled usage are both supported.
