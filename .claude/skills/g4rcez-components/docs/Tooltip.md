---
title: Tooltip
description: Polymorphic tooltip with hover, focus, and click triggers; supports cursor-following and rich content.
package: "@g4rcez/components"
export: "{ Tooltip }"
import: "import { Tooltip } from '@g4rcez/components/tooltip'"
category: floating
---

# Tooltip

Polymorphic tooltip with hover, focus, and click triggers; supports cursor-following and rich content.

## Import

```tsx
import { Tooltip } from "@g4rcez/components/tooltip";
```

## Props

| Prop           | Type                      | Default  | Description                                                   |
| -------------- | ------------------------- | -------- | ------------------------------------------------------------- |
| `title`        | `Label`                   | —        | Tooltip trigger element — the element the user interacts with |
| `children`     | `React.ReactNode`         | —        | Tooltip popup content                                         |
| `open`         | `boolean`                 | —        | Controlled open state                                         |
| `enabled`      | `boolean`                 | `true`   | Enable or disable the tooltip entirely                        |
| `hover`        | `boolean`                 | `true`   | Show tooltip on hover                                         |
| `focus`        | `boolean`                 | `true`   | Show tooltip on focus                                         |
| `popover`      | `boolean`                 | `true`   | Show tooltip on click                                         |
| `placement`    | `Placement`               | auto     | Preferred placement; falls back via `autoPlacement`           |
| `followCursor` | `boolean`                 | `false`  | Tooltip follows the mouse cursor position                     |
| `onChange`     | `(open: boolean) => void` | —        | Open state change handler                                     |
| `as`           | `React.ElementType`       | `"span"` | HTML element to render the trigger wrapper as                 |

> Note: `title` is the **trigger** and `children` is the **popup content**. This is the inverse of the HTML `title` attribute convention — the prop name matches how the component API evolved.

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                     | CSS Variable           | Purpose                               |
| ------------------------- | ---------------------- | ------------------------------------- |
| `bg-tooltip-background`   | `--tooltip-background` | Tooltip popup background              |
| `text-tooltip-foreground` | `--tooltip-foreground` | Tooltip popup text color              |
| `border-tooltip-border`   | `--tooltip-border`     | Tooltip popup border and arrow stroke |
| `fill-tooltip-background` | `--tooltip-background` | Arrow fill color                      |
| `z-tooltip`               | `--z-tooltip`          | Z-index of the tooltip popup          |
| `shadow-shadow-floating`  | `--shadow-floating`    | Tooltip drop shadow                   |

## Placement Options

Supports all Floating UI placements: `"top"`, `"top-start"`, `"top-end"`, `"bottom"`, `"bottom-start"`, `"bottom-end"`, `"left"`, `"left-start"`, `"left-end"`, `"right"`, `"right-start"`, `"right-end"`. When `placement` is omitted, `autoPlacement` picks the best available side.

## Examples

### Basic Hover Tooltip

```tsx
import { Tooltip } from "@g4rcez/components/tooltip";

<Tooltip title={<button className="px-4 py-2 bg-primary text-primary-foreground rounded-button-radius">Hover me</button>}>
    This is a helpful tooltip
</Tooltip>;
```

### Icon Button with Label

```tsx
import { FloppyDiskIcon } from "@phosphor-icons/react";
import { Tooltip } from "@g4rcez/components/tooltip";
import { Button } from "@g4rcez/components/button";

<Tooltip
    title={
        <Button size="icon" theme="ghost-neutral">
            <FloppyDiskIcon size={16} />
        </Button>
    }
>
    Save (Ctrl+S)
</Tooltip>;
```

### Interaction Modes

```tsx
import { Tooltip } from "@g4rcez/components/tooltip";

{
    /* Hover only */
}
<Tooltip
    title={<button className="px-4 py-2 rounded-button-radius border border-border text-foreground">Hover Only</button>}
    focus={false}
    popover={false}
>
    Shown on hover
</Tooltip>;

{
    /* Focus only — keyboard accessible */
}
<Tooltip
    title={<input placeholder="Focus me with tab" className="px-3 py-2 rounded-button-radius border border-border bg-background text-foreground" />}
    hover={false}
    popover={false}
>
    Shown on focus
</Tooltip>;

{
    /* Click only — acts like a popover */
}
<Tooltip title={<button className="px-4 py-2 bg-primary text-primary-foreground rounded-button-radius">Click me</button>} hover={false} focus={false}>
    Shown on click
</Tooltip>;
```

### Cursor-Following Tooltip

```tsx
import { Tooltip } from "@g4rcez/components/tooltip";

<Tooltip
    followCursor
    placement="top-start"
    title={
        <div className="w-full h-32 rounded-card-radius border border-border bg-muted flex items-center justify-center">
            <span className="text-muted-foreground">Move your mouse over this area</span>
        </div>
    }
>
    Follows your cursor
</Tooltip>;
```

### Controlled Tooltip

```tsx
import { useState } from "react";
import { Tooltip } from "@g4rcez/components/tooltip";

function ControlledTooltip() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <Tooltip
                title={<button className="px-4 py-2 rounded-button-radius border border-border text-foreground">Target</button>}
                open={isOpen}
                onChange={setIsOpen}
                hover={false}
                focus={false}
                popover={false}
            >
                Externally controlled
            </Tooltip>

            <div className="mt-4 flex gap-2">
                <button onClick={() => setIsOpen(true)} className="px-3 py-1 bg-primary text-primary-foreground rounded-button-radius text-sm">
                    Show
                </button>
                <button onClick={() => setIsOpen(false)} className="px-3 py-1 bg-muted text-foreground rounded-button-radius text-sm">
                    Hide
                </button>
            </div>
        </>
    );
}
```

### Polymorphic — Render as Different Elements

```tsx
import { Tooltip } from "@g4rcez/components/tooltip";

{
    /* Render as <div> */
}
<Tooltip as="div" title={<span className="p-3 bg-muted rounded-button-radius inline-block text-foreground">Div with tooltip</span>}>
    Tooltip on a div
</Tooltip>;

{
    /* Wrap a paragraph */
}
<Tooltip as="p" title={<span className="text-primary cursor-pointer">Hover this paragraph</span>}>
    Paragraph tooltip
</Tooltip>;
```

### Form Field Help Tooltip

```tsx
import { InfoIcon } from "@phosphor-icons/react";
import { Tooltip } from "@g4rcez/components/tooltip";

<label className="block text-sm font-medium text-foreground mb-1">
    Username
    <Tooltip title={<InfoIcon className="inline ml-1 text-muted-foreground cursor-help" size={14} />}>
        3–20 characters; letters, numbers, and underscores only
    </Tooltip>
</label>;
```

## Do

- Always keep `focus={true}` (default) so keyboard users can access tooltips via Tab navigation.
- Keep tooltip content short — one or two sentences at most.
- Use `followCursor` for large interactive areas (charts, canvases) to keep the tip near the pointer.
- Use design-token classes for any custom elements inside the tooltip popup (`text-tooltip-foreground`, `bg-muted`, etc.).

## Don't

- Don't put essential information only in a tooltip — users on touch devices may never see it.
- Don't use tooltips for long text or complex layouts — use `Modal` or `Dropdown` instead.
- Don't pass raw Tailwind color classes (`bg-gray-900`, `text-white`) inside tooltip content — use design-token classes.
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `z-[9999]`) — override CSS variables in your `@theme` block.
- Don't use tooltips on elements that are already self-explanatory.

## Accessibility

- By default all three triggers are active (`hover`, `focus`, `popover`); disable `focus` only when the trigger itself provides equivalent keyboard affordance.
- The tooltip popup receives `role="tooltip"` via Floating UI's `useRole`.
- `useDismiss` closes the tooltip when focus moves away or `Escape` is pressed.
- Safe-polygon hover handling keeps the tooltip open while the pointer moves toward interactive content (`popover={true}` enables this).
- The `as` prop lets you place the reference on a semantically correct element without extra wrapper divs.

## Notes

- The `open` prop syncs to internal state via `useEffect`; when provided, external changes override internal toggle state.
- `autoPlacement` middleware runs alongside `flip` — placement is fully automatic when `placement` is omitted.
- Hover delay is controlled by the shared `FLOATING_DELAY` constant; there is no per-instance delay prop.
- The component is polymorphic via the `Polymorph` core component for the popup and `as` for the trigger wrapper.
