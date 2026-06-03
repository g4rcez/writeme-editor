---
title: CommandPalette
description: Searchable command palette with fuzzy search, keyboard shortcuts, and grouped commands.
package: "@g4rcez/components"
export: "{ CommandPalette }"
import: "import { CommandPalette } from '@g4rcez/components'"
category: floating
---

# CommandPalette

Searchable command palette with fuzzy search, keyboard shortcuts, and grouped commands.

## Import

```tsx
import { CommandPalette } from "@g4rcez/components";
```

## Props

| Prop                 | Type                                                                   | Default     | Description                                    |
| -------------------- | ---------------------------------------------------------------------- | ----------- | ---------------------------------------------- |
| `open`               | `boolean`                                                              | —           | Controlled open state                          |
| `commands`           | `CommandItemTypes[]`                                                   | —           | Array of commands to display                   |
| `onChangeVisibility` | `(next: boolean) => void`                                              | —           | Open/close handler                             |
| `bind`               | `string`                                                               | `"Mod + k"` | Global keyboard shortcut to open the palette   |
| `loading`            | `boolean`                                                              | `false`     | Show loading skeleton while commands load      |
| `emptyMessage`       | `Label`                                                                | —           | Message shown when no results match            |
| `footer`             | `React.ReactElement`                                                   | —           | Custom footer content                          |
| `onChangeText`       | `(text: string) => void`                                               | —           | Search text change handler                     |
| `Preview`            | `React.FC<{ command: CommandItemTypes; text: string }>`                | —           | Preview panel component for the active command |
| `Icon`               | `React.FC<IconProps & { text: string; Default: React.FC<IconProps> }>` | —           | Custom search icon                             |

## Command Types

### CommandShortcutItem

```tsx
type CommandShortcutItem = {
    type: "shortcut";
    title: string | ((props: { text: string }) => string);
    hint?: string | string[];
    shortcut?: string;
    Icon?: React.ReactElement;
    enabled?: boolean | ((props: { text: string }) => boolean);
    action: (args: {
        text: string;
        setText: (state: string) => void;
        setOpen: (state: boolean) => void;
        event: KeyboardEvent | React.MouseEvent | React.KeyboardEvent;
    }) => void | Promise<void>;
};
```

### CommandGroupItem

```tsx
type CommandGroupItem = {
    type: "group";
    title: string | ((props: { text: string }) => string);
    items: CommandItemTypes[];
};
```

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                    | CSS Variable            | Purpose                                |
| ------------------------ | ----------------------- | -------------------------------------- |
| `bg-floating-background` | `--floating-background` | Palette surface background             |
| `border-floating-border` | `--floating-border`     | Palette surface border                 |
| `bg-floating-hover`      | `--floating-hover`      | Hovered/active command item background |
| `z-floating`             | `--z-floating`          | Z-index for the search header          |
| `text-secondary`         | `--secondary`           | Group label and empty state text color |

## Examples

### Basic Command Palette

```tsx
import { useState } from "react";
import { FileTextIcon, FloppyDiskIcon, FolderOpenIcon } from "@phosphor-icons/react";
import { CommandPalette } from "@g4rcez/components";

function BasicCommandPalette() {
    const [open, setOpen] = useState(false);

    const commands = [
        {
            type: "shortcut" as const,
            title: "New Document",
            shortcut: "Ctrl+N",
            Icon: <FileTextIcon size={16} />,
            action: ({ setOpen }) => {
                console.log("Creating new document");
                setOpen(false);
            },
        },
        {
            type: "shortcut" as const,
            title: "Save Document",
            shortcut: "Ctrl+S",
            Icon: <FloppyDiskIcon size={16} />,
            action: ({ setOpen }) => {
                console.log("Saving document");
                setOpen(false);
            },
        },
        {
            type: "shortcut" as const,
            title: "Open File",
            shortcut: "Ctrl+O",
            Icon: <FolderOpenIcon size={16} />,
            action: ({ setOpen }) => {
                console.log("Opening file");
                setOpen(false);
            },
        },
    ];

    return <CommandPalette open={open} commands={commands} onChangeVisibility={setOpen} />;
}
```

### Grouped Commands

```tsx
import { FileIcon, FolderOpenIcon, HouseIcon, GearIcon, MoonIcon } from "@phosphor-icons/react";
import { CommandPalette } from "@g4rcez/components";

function GroupedCommandPalette() {
    const [open, setOpen] = useState(false);

    const commands = [
        {
            type: "group" as const,
            title: "File Operations",
            items: [
                {
                    type: "shortcut" as const,
                    title: "New File",
                    hint: ["create", "new", "file"],
                    shortcut: "Ctrl+N",
                    Icon: <FileIcon size={16} />,
                    action: ({ setOpen }) => setOpen(false),
                },
                {
                    type: "shortcut" as const,
                    title: "Open File",
                    hint: ["open", "load"],
                    shortcut: "Ctrl+O",
                    Icon: <FolderOpenIcon size={16} />,
                    action: ({ setOpen }) => setOpen(false),
                },
            ],
        },
        {
            type: "group" as const,
            title: "Navigation",
            items: [
                {
                    type: "shortcut" as const,
                    title: "Go to Dashboard",
                    hint: ["dashboard", "home", "main"],
                    Icon: <HouseIcon size={16} />,
                    action: ({ setOpen }) => {
                        window.location.href = "/dashboard";
                        setOpen(false);
                    },
                },
                {
                    type: "shortcut" as const,
                    title: "Go to Settings",
                    hint: ["settings", "preferences", "config"],
                    Icon: <GearIcon size={16} />,
                    action: ({ setOpen }) => {
                        window.location.href = "/settings";
                        setOpen(false);
                    },
                },
            ],
        },
        {
            type: "group" as const,
            title: "Theme",
            items: [
                {
                    type: "shortcut" as const,
                    title: "Toggle Dark Mode",
                    hint: ["dark", "theme", "mode"],
                    Icon: <MoonIcon size={16} />,
                    action: ({ setOpen }) => {
                        document.documentElement.classList.toggle("dark");
                        setOpen(false);
                    },
                },
            ],
        },
    ];

    return <CommandPalette open={open} commands={commands} onChangeVisibility={setOpen} emptyMessage="No commands found" />;
}
```

### Custom Keyboard Shortcut

```tsx
<CommandPalette open={open} commands={commands} onChangeVisibility={setOpen} bind="Mod + /" />
```

### Conditional Commands

```tsx
import { UserIcon, ShieldIcon } from "@phosphor-icons/react";

const commands = [
    {
        type: "shortcut" as const,
        title: "User Dashboard",
        Icon: <UserIcon size={16} />,
        action: ({ setOpen }) => setOpen(false),
    },
    {
        type: "shortcut" as const,
        title: "Admin Panel",
        enabled: user.isAdmin,
        Icon: <ShieldIcon size={16} />,
        action: ({ setOpen }) => {
            console.log("Opening admin panel");
            setOpen(false);
        },
    },
];
```

## Do

- Use `hint` arrays to add synonyms so commands match varied search terms (e.g., `["preferences", "config"]` for a "Settings" command).
- Group related commands with `type: "group"` so users can scan results quickly.
- Provide a clear `emptyMessage` so users know when nothing matches.
- Keep command titles short; let `hint` carry the synonym load.

## Don't

- Don't put every action in the palette — focus on the most useful commands.
- Don't use raw Tailwind color classes (`bg-blue-500`, `text-white`) in custom `Icon` or `Preview` components — use design-token classes instead.
- Don't pass arbitrary Tailwind values (`bg-[#abc]`, `z-[9999]`) — override CSS variables in your `@theme` block.
- Don't omit the global shortcut — the default `Mod+K` is a strong convention users expect.

## Accessibility

- Full arrow-key navigation within the list with loop support.
- `Enter` executes the active command; `Escape` closes the palette.
- Each item renders with `role="option"` and `aria-selected` reflecting the active state.
- The palette is wrapped in a `Modal` with `ariaTitle="Command palette"` for screen readers.
- The search input receives `autoFocus` when the palette opens.

## Data Attributes

| Attribute                                    | Applied to           | Description                           |
| -------------------------------------------- | -------------------- | ------------------------------------- |
| `data-component="command-palette"`           | Root modal container | Identifies the palette root           |
| `data-component="command-palette-list"`      | `<ul>`               | Identifies the command list           |
| `data-component="command-palette-item"`      | Each `<button>` item | Identifies individual command buttons |
| `data-component="command-palette-container"` | List/preview wrapper | Identifies the content area           |

## Notes

- The component registers global keyboard listeners via `CombiKeys`. All `shortcut` commands are also registered as global hotkeys — they fire even when the palette is closed.
- Fuzzy search runs over `title`, `shortcut`, and `hint` fields. When `title` is a function, it is called with the current search text to produce a string for matching.
- Commands with `enabled: false` (or a function returning `false`) are filtered out of results.
- The `Preview` panel is shown only when `activeIndex` is set and a `Preview` component is provided.
- The palette is built on top of `Modal`, so it inherits modal accessibility and portal rendering.
