---
title: Shortcut
description: Inline keyboard shortcut display with automatic OS-specific key symbol mapping.
package: "@g4rcez/components"
export: "{ Shortcut }"
import: "import { Shortcut } from '@g4rcez/components'"
category: display
---

# Shortcut

Inline keyboard shortcut display with automatic OS-specific key symbol mapping.

## Import

```tsx
import { Shortcut } from "@g4rcez/components";
```

## Props

| Prop    | Type     | Default | Description                                                         |
| ------- | -------- | ------- | ------------------------------------------------------------------- |
| `value` | `string` | —       | Shortcut string to display, e.g. `"Mod + K"` or `"Shift + Alt + P"` |

## Design Tokens

The `Shortcut` component inherits text color and size from its parent. No component-scoped tokens.

## OS Mapping

The component automatically maps keys based on the user's operating system:

| Key token | macOS                          | Other  |
| --------- | ------------------------------ | ------ |
| `Mod`     | `⌘` (CommandIcon, `size={12}`) | `Ctrl` |
| `Alt`     | `⌥` (OptionIcon, `size={12}`)  | `Alt`  |

All other key tokens are rendered as-is.

## Examples

### Basic Usage

```tsx
<Shortcut value="Mod + K" />
```

### In a Tooltip

```tsx
<Tooltip title="Save changes">
    <div className="flex gap-2 items-center">
        Save <Shortcut value="Mod + S" />
    </div>
</Tooltip>
```

### In a Command Palette Item

```tsx
<div className="flex items-center justify-between w-full">
    <span>Open command palette</span>
    <Shortcut value="Mod + K" />
</div>
```

### Complex Multi-Key Shortcuts

```tsx
<Shortcut value="Shift + Alt + P" />
<Shortcut value="Mod + Shift + L" />
```

### In a Menu Item

```tsx
<div className="flex items-center justify-between px-4 py-2">
    <span className="text-foreground">New File</span>
    <Shortcut value="Mod + N" />
</div>
```

## Do

- Use `"Mod"` instead of `"Ctrl"` or `"Cmd"` to get automatic platform-specific rendering.
- Use `"Alt"` for the Option/Alt key — it also gets platform-specific rendering on macOS.
- Place `Shortcut` next to the label of the action it accelerates (button, menu item, tooltip).

## Don't

- Don't hardcode platform symbols like `⌘` or `Ctrl` directly — let `Shortcut` handle the mapping.
- Don't pass arbitrary Tailwind values (`text-[--my-var]`) for text color — let the component inherit from its parent.
- Don't use `Shortcut` for descriptive text longer than a typical keyboard combination.

## Accessibility

- Each key segment renders inside a `<kbd>` element with an `aria-label` equal to the raw key name (e.g. `aria-label="Mod"`), so screen readers announce the semantic name regardless of the visual symbol.
- Icon-based keys (`CommandIcon`, `OptionIcon`) also carry their own `aria-label` attribute.

## Notes

- The component renders a `<span>` with `flex items-center gap-1 text-sm`.
- Keys are split on `"+"` and trimmed, so `"Mod + K"`, `"Mod+K"`, and `"Mod +K"` all produce the same output.
- The OS check uses `isMac()` from the internal `combi-keys` utility, which reads `navigator.userAgent`.
