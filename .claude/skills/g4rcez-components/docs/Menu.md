---
title: Menu
description: Accessible floating menu system with nested submenus, keyboard navigation, hover support, and typeahead.
package: "@g4rcez/components"
export: "{ Menu, MenuItem }"
import: "import { Menu, MenuItem } from '@g4rcez/components/menu'"
category: floating
---

# Menu

Accessible floating menu system with nested submenus, keyboard navigation, hover support, and typeahead.

## Import

```tsx
import { Menu, MenuItem } from "@g4rcez/components/menu";
```

## Props

### Menu

| Prop                | Type                           | Default | Description                                                                                     |
| ------------------- | ------------------------------ | ------- | ----------------------------------------------------------------------------------------------- |
| `label`             | `string \| React.ReactElement` | —       | Trigger content                                                                                 |
| `title`             | `string`                       | —       | Required for accessibility when `label` is an element; also used for typeahead                  |
| `hover`             | `boolean`                      | `true`  | Open on hover in addition to click                                                              |
| `open`              | `boolean`                      | `false` | Initial open state                                                                              |
| `asChild`           | `boolean`                      | `false` | Use the `Slot` pattern — merge props onto the child element instead of wrapping in a `<button>` |
| `restoreFocus`      | `boolean`                      | `false` | Restore focus to the trigger after the menu closes                                              |
| `floatingClassName` | `string`                       | —       | Additional CSS classes for the floating list container                                          |
| `FloatingComponent` | `React.ElementType`            | `"div"` | Element type for the floating container                                                         |

### MenuItem

| Prop       | Type                  | Default | Description                                                      |
| ---------- | --------------------- | ------- | ---------------------------------------------------------------- |
| `title`    | `string`              | —       | Item text; used for typeahead matching and the `title` attribute |
| `children` | `React.ReactNode`     | —       | Visual content of the item                                       |
| `disabled` | `boolean`             | `false` | Removes item from keyboard navigation and typeahead              |
| `Right`    | `React.FC<IconProps>` | —       | Icon rendered on the right side                                  |
| `onClick`  | `function`            | —       | Click handler                                                    |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                     | CSS Variable            | Purpose                        |
| ------------------------- | ----------------------- | ------------------------------ |
| `bg-floating-background`  | `--floating-background` | Menu list surface background   |
| `border-floating-border`  | `--floating-border`     | Menu list border               |
| `shadow-shadow-floating`  | `--shadow-floating`     | Menu list drop shadow          |
| `z-tooltip`               | `--z-tooltip`           | Z-index of the floating list   |
| `bg-primary`              | `--primary`             | Active/focused item background |
| `text-primary-foreground` | `--primary-foreground`  | Active/focused item text       |

## Examples

### Basic Menu

```tsx
import { Menu, MenuItem } from "@g4rcez/components/menu";

<Menu label="Actions">
    <MenuItem title="Edit">Edit Profile</MenuItem>
    <MenuItem title="Share">Share Profile</MenuItem>
</Menu>;
```

### With Icons and Shortcuts

```tsx
import { PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react";
import { Menu, MenuItem } from "@g4rcez/components/menu";

<Menu label="Settings">
    <MenuItem title="Edit" Right={PencilSimpleIcon}>
        Edit
    </MenuItem>
    <MenuItem title="Delete" Right={TrashIcon} className="text-danger">
        Delete
    </MenuItem>
</Menu>;
```

### Nested Submenus

```tsx
import { Menu, MenuItem } from "@g4rcez/components/menu";

<Menu label="Actions">
    <MenuItem title="Edit">Edit Profile</MenuItem>
    <MenuItem title="Share">Share Profile</MenuItem>
    <Menu label="More Options" title="More Options">
        <MenuItem title="Archive">Archive Account</MenuItem>
        <MenuItem title="Delete" className="text-danger">
            Delete Account
        </MenuItem>
    </Menu>
</Menu>;
```

### Using asChild for Custom Triggers

```tsx
import { Menu, MenuItem } from "@g4rcez/components/menu";
import { Button } from "@g4rcez/components/button";

<Menu label={<Button theme="primary">Main Action</Button>} asChild title="Main Action">
    <MenuItem title="Save">Save Version</MenuItem>
    <MenuItem title="Publish">Publish Now</MenuItem>
</Menu>;
```

### Disabled Items

```tsx
import { Menu, MenuItem } from "@g4rcez/components/menu";

<Menu label="Options">
    <MenuItem title="Export">Export Data</MenuItem>
    <MenuItem title="Import" disabled>
        Import (unavailable)
    </MenuItem>
    <MenuItem title="Delete" className="text-danger">
        Delete
    </MenuItem>
</Menu>;
```

## Do

- Provide a `title` string whenever `label` is a React element — it enables typeahead and improves accessibility.
- Use nested `Menu` components (not just `MenuItem`) for logical groupings of secondary actions.
- Use `disabled` for actions temporarily unavailable, so users know the option exists.
- Use design-token classes (`text-danger`, `text-foreground`) for item text colors.

## Don't

- Don't make menus deeper than 2–3 levels — deeply nested submenus are hard to navigate.
- Don't use raw Tailwind color classes (`text-red-600`, `hover:bg-gray-100`) on items — use design-token classes.
- Don't use arbitrary Tailwind values (`bg-[#abc]`) — override CSS variables in your `@theme` block.
- Don't use `Menu` for primary navigation that should be crawlable — use standard `<a>` links instead.

## Accessibility

- Full keyboard navigation: arrow keys navigate items, `Enter`/`Space` select, `Escape` closes.
- Typeahead: typing the first characters of an item's `title` focuses it instantly (resets after inactivity).
- Correct ARIA roles: `menu` on the container, `menuitem` on each item, `aria-expanded` on nested triggers.
- `data-active` marks the currently focused item for CSS styling.
- `FloatingFocusManager` handles focus trapping and restoration.

## Data Attributes

| Attribute           | Applied to             | Description                                  |
| ------------------- | ---------------------- | -------------------------------------------- |
| `data-open`         | Menu trigger, MenuItem | Present when the menu/item is open           |
| `data-nested`       | Nested menu trigger    | Present on triggers that open a submenu      |
| `data-focus-inside` | Menu trigger           | Present when focus is inside an open submenu |
| `data-active`       | MenuItem               | Present on the currently focused item        |

## Notes

- The root `Menu` wraps itself in a `FloatingTree`; nested `Menu` components detect this via `useFloatingParentNodeId` and behave as submenus.
- Hover delay is controlled by the `FLOATING_DELAY` constant. The safe-polygon handler keeps the menu open while the pointer moves toward the submenu.
- When `hover` is `false`, the menu opens only on click.
- The floating container default `max-h-80` prevents the list from growing taller than the viewport.
