---
title: Resizable
description: A wrapper that animates its height smoothly when content dimensions change.
package: "@g4rcez/components"
export: "{ Resizable }"
import: "import { Resizable } from '@g4rcez/components'"
category: core
---

# Resizable

A wrapper that automatically animates its height whenever the inner content size changes. Uses `ResizeObserver` to detect dimension changes and `motion/react` to drive smooth height transitions.

## Import

```tsx
import { Resizable } from "@g4rcez/components";
```

## Props

| Prop       | Type              | Default | Description                                    |
| ---------- | ----------------- | ------- | ---------------------------------------------- |
| `children` | `React.ReactNode` | -       | Content rendered inside the animated container |

## Design Tokens

None — `Resizable` is a layout animation primitive that applies no color or spacing tokens.

## How It Works

1. An inner `<div>` holds the children and is observed by a `ResizeObserver`.
2. When the inner `div`'s height changes, the observed height value updates via a motion value.
3. An outer `motion.div` animates from the previous height to the new height using `motion/react`.
4. While the content has no measured height yet (`h === 0`), the container uses `height: "auto"`.

## Examples

### Collapsible Content

```tsx
import { useState } from "react";

const CollapsiblePanel = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border border-border rounded-card-radius">
            <button type="button" className="w-full px-4 py-3 text-left font-medium text-foreground" onClick={() => setIsOpen((v) => !v)}>
                Toggle Details
            </button>
            <Resizable>
                {isOpen ? (
                    <div className="px-4 pb-4 text-foreground">
                        <p>This content expands and collapses with a smooth height animation.</p>
                        <p>Additional paragraphs will also animate smoothly.</p>
                    </div>
                ) : null}
            </Resizable>
        </div>
    );
};
```

### Dynamic List

```tsx
import { useState } from "react";
import { Button } from "@g4rcez/components/button";

const GrowingList = () => {
    const [items, setItems] = useState(["Item 1"]);

    return (
        <div className="flex flex-col gap-base">
            <Button theme="primary" onClick={() => setItems((prev) => [...prev, `Item ${prev.length + 1}`])}>
                Add Item
            </Button>
            <Resizable>
                <ul className="flex flex-col gap-sm">
                    {items.map((item) => (
                        <li key={item} className="text-foreground">
                            {item}
                        </li>
                    ))}
                </ul>
            </Resizable>
        </div>
    );
};
```

### Animated Tab Panels

```tsx
const TabbedContent = ({ activeTab }: { activeTab: string }) => (
    <Resizable>
        <div className="p-4 text-foreground">
            {activeTab === "overview" && <OverviewPanel />}
            {activeTab === "settings" && <SettingsPanel />}
            {activeTab === "history" && <HistoryPanel />}
        </div>
    </Resizable>
);
```

### Async Content Loading

```tsx
const AsyncCard = ({ data }: { data: string[] | null }) => (
    <div className="rounded-card-radius border border-border bg-card-background shadow-shadow-card">
        <Resizable>
            {data === null ? (
                <div className="p-4 text-muted-foreground">Loading…</div>
            ) : (
                <ul className="p-4 flex flex-col gap-sm">
                    {data.map((item) => (
                        <li key={item} className="text-foreground">
                            {item}
                        </li>
                    ))}
                </ul>
            )}
        </Resizable>
    </div>
);
```

## Do

- Use `Resizable` around any content that changes height to provide a polished animation
- Wrap only the specific dynamic section — not large, stable portions of the page
- Apply visual styles (`bg-*`, `border-*`, `rounded-*`) to elements inside `Resizable`, not to `Resizable` itself
- Use design-token classes for all styling (`bg-background`, `border-border`, `rounded-card-radius`)

## Don't

- Don't use `Resizable` on content that changes height at very high frequency (e.g., per-frame updates) — it may cause performance issues
- Don't wrap large, stable sections of a page — keep the observed area small
- Don't pass raw Tailwind color classes (`bg-white`, `border-gray-200`) inside `Resizable` wrappers — use design tokens
- Don't use arbitrary Tailwind values (`bg-[#fff]`) — override CSS variables in your `@theme` block

## Accessibility

- `Resizable` is a layout animation wrapper and introduces no semantic elements or ARIA attributes
- Ensure content inside maintains correct focus order and accessible roles
- For accordion/collapsible patterns, add `aria-expanded` and `aria-controls` to the trigger button

## Notes

- Requires `motion/react` as a peer dependency
- The outer `motion.div` drives the height animation; the inner `div` is the measured reference
- SSR-safe: `isSsr()` prevents `ResizeObserver` from being created on the server
- The component is a client component (`"use client"`)
