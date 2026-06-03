---
title: Toolbar
description: Sticky floating toolbar for surfacing persistent actions at the bottom of a scrollable area.
package: "@g4rcez/components"
export: "{ Toolbar }"
import: "import { Toolbar } from '@g4rcez/components'"
category: floating
---

# Toolbar

Sticky floating toolbar for surfacing persistent actions at the bottom of a scrollable area.

## Import

```tsx
import { Toolbar } from "@g4rcez/components";
```

## Props

| Prop       | Type              | Default | Description                                           |
| ---------- | ----------------- | ------- | ----------------------------------------------------- |
| `children` | `React.ReactNode` | —       | Items displayed inside the toolbar                    |
| `root`     | `HTMLElement`     | —       | Optional root element reference for scrolling context |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                | CSS Variable    | Purpose                    |
| -------------------- | --------------- | -------------------------- |
| `bg-background`      | `--background`  | Toolbar surface background |
| `border-card-border` | `--card-border` | Toolbar border             |
| `rounded-lg`         | —               | Toolbar corner radius      |

## Examples

### Form Actions Toolbar

```tsx
import { Toolbar } from "@g4rcez/components";
import { Button } from "@g4rcez/components/button";

<Toolbar>
    <Button theme="ghost-muted">Cancel</Button>
    <Button theme="primary">Save Changes</Button>
</Toolbar>;
```

### Rich Text Editor Toolbar

```tsx
import { BoldIcon, ItalicIcon, UnderlineIcon } from "@phosphor-icons/react";
import { Toolbar } from "@g4rcez/components";
import { Button } from "@g4rcez/components/button";
import { Tooltip } from "@g4rcez/components/tooltip";

<Toolbar>
    <Tooltip title="Bold">
        <Button size="icon" theme="ghost-neutral">
            <BoldIcon size={16} />
        </Button>
    </Tooltip>
    <Tooltip title="Italic">
        <Button size="icon" theme="ghost-neutral">
            <ItalicIcon size={16} />
        </Button>
    </Tooltip>
    <Tooltip title="Underline">
        <Button size="icon" theme="ghost-neutral">
            <UnderlineIcon size={16} />
        </Button>
    </Tooltip>
    <div className="mx-2 h-6 w-px bg-card-border" />
    <Button theme="primary" size="small">
        Publish
    </Button>
</Toolbar>;
```

### Batch Action Toolbar

```tsx
import { TrashIcon, DownloadIcon } from "@phosphor-icons/react";
import { Toolbar } from "@g4rcez/components";
import { Button } from "@g4rcez/components/button";

function BatchToolbar({ selectedCount }: { selectedCount: number }) {
    if (selectedCount === 0) return null;

    return (
        <Toolbar>
            <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
            <Button theme="ghost-neutral" size="small">
                <DownloadIcon size={16} />
                Export
            </Button>
            <Button theme="danger" size="small">
                <TrashIcon size={16} />
                Delete
            </Button>
        </Toolbar>
    );
}
```

## Do

- Keep the toolbar small — it overlays content and should not obscure more than a thin strip at the bottom.
- Reserve the toolbar for primary actions users may need at any scroll position.
- Provide sufficient spacing between touch targets for mobile usability.
- Use design-token classes for any custom styling inside the toolbar (`bg-background`, `border-card-border`, `text-foreground`).

## Don't

- Don't use `Toolbar` for secondary or rarely used actions — keep the surface focused.
- Don't cram too many items into the toolbar; it will wrap awkwardly on narrow viewports.
- Don't pass raw Tailwind color classes (`bg-gray-100`, `border-gray-300`) — use design-token classes.
- Don't use arbitrary Tailwind values (`bg-[#abc]`) — override CSS variables in your `@theme` block.

## Accessibility

- Wrap the toolbar in a `<div role="toolbar" aria-label="Page actions">` when it contains only icon buttons, so assistive technologies can announce the region.
- Ensure each icon-only button inside the toolbar has an accessible name via `aria-label` or a `Tooltip` with `focus={true}`.
- Tab key navigates through items in the toolbar naturally.

## Notes

- The component is a thin wrapper around `motion.div` from `motion/react` with `sticky bottom-4` positioning.
- The `root` prop is accepted but not yet used in the current implementation — it is reserved for future scrolling context support.
- Because the toolbar is `sticky` (not `fixed`), it flows with the document and sticks at the bottom of its scrolling container, not the viewport.
