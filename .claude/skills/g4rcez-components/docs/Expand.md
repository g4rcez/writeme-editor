---
title: Expand
description: A button that expands in-place into a floating container using shared-element layout animations.
package: "@g4rcez/components"
export: "{ Expand }"
import: "import { Expand } from '@g4rcez/components/expand'"
category: floating
---

# Expand

A button that expands in-place into a floating container using shared-element layout animations.

## Import

```tsx
import { Expand } from "@g4rcez/components/expand";
```

## Props

`Expand` accepts all `Button` props plus the following:

| Prop       | Type              | Default | Description                                          |
| ---------- | ----------------- | ------- | ---------------------------------------------------- |
| `trigger`  | `Label`           | —       | Content displayed on the button before expansion     |
| `open`     | `boolean`         | `false` | Controlled open state                                |
| `disabled` | `boolean`         | `false` | When `true`, the button cannot be expanded           |
| `children` | `React.ReactNode` | —       | Content shown inside the expanded floating container |

Inherits all `Button` props: `theme`, `size`, `rounded`, `className`, etc.

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token           | CSS Variable   | Purpose                                                 |
| --------------- | -------------- | ------------------------------------------------------- |
| `bg-background` | `--background` | Default expanded panel background (applied by consumer) |
| `border-border` | `--border`     | Default expanded panel border (applied by consumer)     |

The `Expand` component itself only renders the trigger button and an animated wrapper; visual tokens for the expanded content are your responsibility via `children` className.

## Examples

### Action FAB

```tsx
import { PlusIcon } from "@phosphor-icons/react";
import { Expand } from "@g4rcez/components/expand";

<Expand trigger={<PlusIcon size={16} />} theme="primary" size="icon" rounded="circle">
    <div className="w-64 rounded-card-radius border border-border bg-background p-4 shadow-shadow-floating">
        <h3 className="font-bold mb-2 text-foreground">Create New</h3>
        <ul className="space-y-2">
            <li>
                <button className="w-full rounded-button-radius p-2 text-left text-foreground hover:bg-muted">Project</button>
            </li>
            <li>
                <button className="w-full rounded-button-radius p-2 text-left text-foreground hover:bg-muted">Task</button>
            </li>
        </ul>
    </div>
</Expand>;
```

### Expand with Label

```tsx
import { Expand } from "@g4rcez/components/expand";
import { Button } from "@g4rcez/components/button";

<Expand trigger="Open Menu">
    <div className="rounded-card-radius border border-border bg-background p-4 shadow-shadow-floating">
        <p className="text-foreground">Expanded content goes here.</p>
        <Button theme="primary" className="mt-2">
            Action
        </Button>
    </div>
</Expand>;
```

### Controlled Expand

```tsx
import { useState } from "react";
import { Expand } from "@g4rcez/components/expand";

function ControlledExpand() {
    const [open, setOpen] = useState(false);

    return (
        <Expand trigger="Options" open={open} theme="ghost-neutral">
            <div className="rounded-card-radius border border-border bg-background p-4 shadow-shadow-floating">
                <button onClick={() => setOpen(false)} className="text-sm text-foreground">
                    Close
                </button>
            </div>
        </Expand>
    );
}
```

## Do

- Use `Expand` when you want the expanded panel to appear to "grow out of" the trigger button — the shared-element transition reinforces spatial context.
- Apply design-token classes on the expanded content (`bg-background`, `border-border`, `shadow-shadow-floating`) for consistent theming.
- Provide accessible `trigger` text or an icon with a `sr-only` label.

## Don't

- Don't use `Expand` when a standard `Dropdown` or `Modal` would feel more familiar to the user — the animation is distinctive and should be reserved for intentional moments.
- Don't nest multiple `Expand` components inside each other; layout animations can conflict.
- Don't pass raw Tailwind color classes (`bg-gray-50`, `border-gray-200`) inside the expanded content — use design-token classes.
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `shadow-[--my-shadow]`) — override CSS variables in your `@theme` block.

## Accessibility

- The trigger renders as a focusable `<button>` via the `Button` component.
- `FloatingFocusManager` with `visuallyHiddenDismiss` and `closeOnFocusOut` manages focus correctly when the panel opens.
- Pressing `Escape` closes the expanded panel (`useDismiss` with `escapeKey: true`).
- Clicking outside also closes the panel (`outsidePress: true`).

## Notes

- Uses `motion/react` (`layoutId`) to animate a seamless transition between the collapsed button and the expanded container.
- The expanded container is absolutely positioned at `-left-1/4 -top-3/4` by default. Override via `className` on the children wrapper if needed.
- The `disabled` prop is forwarded to `useClick` — when `true`, the click interaction is enabled (the prop name is semantically inverted in the hook call, so pass `disabled={true}` to prevent expansion).
- Rendered inside a `FloatingPortal` scoped to the component's own root `<div>` so it stays visually attached.
