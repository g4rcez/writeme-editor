---
title: Modal
description: Animated modal with dialog, drawer, and sheet variants; includes drag-to-resize and a programmatic confirm utility.
package: "@g4rcez/components"
export: "{ Modal, ModalConfirmProvider, useConfirm }"
import: "import { Modal } from '@g4rcez/components/modal'"
category: floating
---

# Modal

Animated modal with dialog, drawer, and sheet variants; includes drag-to-resize and a programmatic confirm utility.

## Import

```tsx
import { Modal, ModalConfirmProvider, useConfirm } from "@g4rcez/components/modal";
```

## Props

| Prop                | Type                              | Default    | Description                                                   |
| ------------------- | --------------------------------- | ---------- | ------------------------------------------------------------- |
| `open`              | `boolean`                         | —          | Controls modal visibility                                     |
| `onChange`          | `(nextState: boolean) => void`    | —          | Callback when modal state changes                             |
| `title`             | `React.ReactNode`                 | —          | Modal title; creates a `<h2>` header                          |
| `ariaTitle`         | `string`                          | —          | ARIA label used when no visible `title` is provided           |
| `footer`            | `React.ReactNode`                 | —          | Footer content                                                |
| `type`              | `"dialog" \| "drawer" \| "sheet"` | `"dialog"` | Modal display variant                                         |
| `position`          | `"left" \| "right"`               | `"right"`  | Drawer slide-in side (drawer type only)                       |
| `animated`          | `boolean`                         | `true`     | Enable enter/exit animations                                  |
| `closable`          | `boolean`                         | `true`     | Show the close button                                         |
| `resizer`           | `boolean`                         | `true`     | Show the drag-to-resize handle (drawer and sheet)             |
| `forceType`         | `boolean`                         | `false`    | Disable responsive behavior — keep `type` on all screen sizes |
| `overlayClickClose` | `boolean`                         | `false`    | Close when clicking the backdrop                              |
| `trigger`           | `React.ReactNode \| React.FC`     | —          | Element that toggles the modal when clicked                   |
| `asChild`           | `boolean`                         | `false`    | Merge trigger props onto the child element via `Slot`         |
| `className`         | `string`                          | —          | Additional classes for the modal surface                      |
| `bodyClassName`     | `string`                          | —          | Additional classes for the scrollable body                    |
| `overlayClassName`  | `string`                          | —          | Additional classes for the backdrop overlay                   |
| `layoutId`          | `string`                          | —          | Framer Motion layout ID for shared-element transitions        |
| `role`              | `"dialog"`                        | `"dialog"` | ARIA role                                                     |
| `interactions`      | `ElementProps[]`                  | `[]`       | Extra Floating UI interaction hooks                           |

## Modal Types

| Type     | Behavior                                  | Best for                  |
| -------- | ----------------------------------------- | ------------------------- |
| `dialog` | Centered overlay with backdrop            | Confirmations, forms      |
| `drawer` | Slides in from left or right; full height | Navigation, detail panels |
| `sheet`  | Slides up from bottom; full width         | Mobile action sheets      |

On mobile (`< 64 rem`) drawers automatically become sheets unless `forceType` is set.

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                    | CSS Variable            | Purpose                                            |
| ------------------------ | ----------------------- | -------------------------------------------------- |
| `bg-floating-background` | `--floating-background` | Modal surface background                           |
| `border-floating-border` | `--floating-border`     | Modal border, header/footer dividers, resizer      |
| `bg-floating-overlay`    | `--floating-overlay`    | Backdrop color (with `/70` opacity)                |
| `z-overlay`              | `--z-overlay`           | Z-index of the backdrop                            |
| `z-floating`             | `--z-floating`          | Z-index of the modal surface and close button      |
| `w-dialog`               | `--dialog`              | Default max-width for dialog type (`max-w-dialog`) |
| `text-foreground`        | `--foreground`          | Body text color                                    |
| `text-danger`            | `--danger`              | Close button hover color                           |

## Examples

### Basic Dialog

```tsx
import { useState } from "react";
import { Modal } from "@g4rcez/components/modal";
import { Button } from "@g4rcez/components/button";

function BasicDialog() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button onClick={() => setOpen(true)}>Open Dialog</Button>

            <Modal open={open} onChange={setOpen} title="Confirm Action">
                <p className="text-foreground">Are you sure you want to proceed?</p>
                <div className="flex gap-2 mt-4">
                    <Button theme="ghost-muted" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button theme="danger" onClick={() => setOpen(false)}>
                        Confirm
                    </Button>
                </div>
            </Modal>
        </>
    );
}
```

### Modal with Footer

```tsx
<Modal
    open={open}
    onChange={setOpen}
    title="User Profile"
    footer={
        <div className="flex justify-end gap-2">
            <Button theme="ghost-muted" onClick={() => setOpen(false)}>
                Cancel
            </Button>
            <Button theme="primary">Save Changes</Button>
        </div>
    }
>
    <form className="space-y-4">
        <div>
            <label className="text-sm font-medium text-foreground">Name</label>
            <input type="text" className="w-full p-2 rounded-button-radius border border-border bg-background text-foreground" />
        </div>
    </form>
</Modal>
```

### Drawer

```tsx
<Modal open={open} onChange={setOpen} type="drawer" position="right" title="Navigation">
    <nav className="space-y-2">
        <a href="/dashboard" className="block rounded-button-radius p-2 text-foreground hover:bg-muted">
            Dashboard
        </a>
        <a href="/profile" className="block rounded-button-radius p-2 text-foreground hover:bg-muted">
            Profile
        </a>
        <a href="/settings" className="block rounded-button-radius p-2 text-foreground hover:bg-muted">
            Settings
        </a>
    </nav>
</Modal>
```

### Sheet

```tsx
<Modal open={open} onChange={setOpen} type="sheet" title="Quick Actions">
    <div className="grid grid-cols-2 gap-4">
        <Button theme="ghost-neutral" className="flex-col h-24">
            Analytics
        </Button>
        <Button theme="ghost-neutral" className="flex-col h-24">
            Revenue
        </Button>
    </div>
</Modal>
```

### Modal with Built-in Trigger

```tsx
<Modal open={open} onChange={setOpen} title="Settings" trigger={<Button theme="primary">Open Settings</Button>}>
    <p className="text-foreground">Settings content here.</p>
</Modal>
```

### Non-closable Processing Modal

```tsx
<Modal open={open} onChange={setOpen} title="Processing..." closable={false}>
    <div className="text-center text-foreground">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p>Please wait while we process your request.</p>
    </div>
</Modal>
```

### Programmatic Confirm Dialog

Wrap your app with `ModalConfirmProvider` once:

```tsx
import { ModalConfirmProvider } from "@g4rcez/components/modal";

export default function App({ children }) {
    return <ModalConfirmProvider>{children}</ModalConfirmProvider>;
}
```

Then call `Modal.confirm` anywhere:

```tsx
import { Modal } from "@g4rcez/components/modal";

async function handleDelete() {
    const confirmed = await Modal.confirm({
        title: "Delete item",
        description: "This action cannot be undone.",
        confirm: { text: "Delete", theme: "danger" },
        cancel: { text: "Cancel" },
    });

    if (confirmed) {
        // proceed with deletion
    }
}
```

Or use the `useConfirm` hook inside a `ModalConfirmProvider` subtree:

```tsx
import { useConfirm } from "@g4rcez/components/modal";

function DeleteButton() {
    const confirm = useConfirm();

    const handleClick = async () => {
        const ok = await confirm({
            title: "Delete item",
            description: "Are you sure?",
        });
        if (ok) {
            // delete
        }
    };

    return (
        <Button theme="danger" onClick={handleClick}>
            Delete
        </Button>
    );
}
```

## Do

- Choose the correct `type` (`dialog`, `drawer`, `sheet`) for the content and context.
- Use `<Modal type="dialog" />` as the default — only switch to `drawer` or `sheet` when layout demands it.
- Always provide either `title` or `ariaTitle` so screen readers can announce the modal.
- Use `footer` for action buttons to keep them separated from body content.

## Don't

- Don't pass custom `z-*`, `rounded-*`, or `p-*` overrides directly — use `type` to control layout variants.
- Don't use raw Tailwind color classes (`bg-blue-500`, `text-white`, `bg-gray-100`) — use design-token classes.
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `z-[9999]`) — override CSS variables in your `@theme` block.
- Don't use `color-mix()` in `className` or `style` props.
- Don't nest modals inside each other — it creates broken focus and z-index behavior.
- Don't hide a modal's only close affordance (`closable={false}`) without providing another way to close.

## Accessibility

- Focus is automatically trapped inside the modal via `FloatingFocusManager` with `guards` and `modal`.
- `Escape` closes the modal (via `useDismiss` with `escapeKey: true`).
- The modal surface receives `aria-labelledby` (when `title` is set) or `aria-label` (when `ariaTitle` is set).
- `aria-modal="true"` is applied to the floating surface.
- Scroll is locked on the body while the modal is open.

## Data Attributes

| Attribute                     | Applied to                  | Description                 |
| ----------------------------- | --------------------------- | --------------------------- |
| `data-component="modal"`      | Modal surface `<div>`       | Identifies the modal root   |
| `data-component="modal-body"` | Scrollable body `<section>` | Identifies the content area |

## Notes

- Drawers auto-switch to sheets on viewports narrower than `64rem` unless `forceType={true}`.
- `resizer` adds a draggable handle: horizontal for drawers, vertical for sheets. Dragging a sheet past 60 % of screen height closes it.
- `layoutId` enables Framer Motion shared-element transitions between a trigger and the modal surface.
- `ModalConfirmProvider` sets a module-level `confirmGlobal` function so `Modal.confirm` works outside React trees (e.g., in event handlers).
- The confirm dialog uses `max-w-dialog` (`w-dialog` token, default `20rem`) and cannot be closed by clicking the overlay.
