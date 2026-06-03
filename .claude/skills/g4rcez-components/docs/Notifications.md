---
title: Notifications
description: Toast notification system with themes, stacking, swipe-to-dismiss, and programmatic control.
package: "@g4rcez/components"
export: "{ Notifications }"
import: "import { Notifications, useNotification } from '@g4rcez/components/notifications'"
category: display
---

# Notifications

Toast notification system with themes, stacking, swipe-to-dismiss, and programmatic control.

## Import

```tsx
import { Notifications, useNotification } from "@g4rcez/components/notifications";
```

## Setup

Wrap your app (or the subtree that needs toasts) with `Notifications`:

```tsx
import { Notifications } from "@g4rcez/components/notifications";

function App() {
    return (
        <Notifications max={5} timeout={5000}>
            <YourApp />
        </Notifications>
    );
}
```

## Props

### Notifications (Provider)

| Prop       | Type              | Default | Description                                   |
| ---------- | ----------------- | ------- | --------------------------------------------- |
| `max`      | `number`          | `5`     | Maximum notifications displayed at once       |
| `timeout`  | `number`          | `5000`  | Default auto-dismiss duration in milliseconds |
| `children` | `React.ReactNode` | —       | Subtree that can use `useNotification`        |

### useNotification — notify function

```tsx
const notify = useNotification();
const subscription = notify(message, options);
```

**Parameters**

| Parameter | Type                  | Description                                   |
| --------- | --------------------- | --------------------------------------------- |
| `message` | `Label`               | Notification body text (string or React node) |
| `options` | `NotificationOptions` | Optional configuration (see below)            |

**NotificationOptions**

| Option     | Type                | Default          | Description                                                                                      |
| ---------- | ------------------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| `id`       | `string`            | —                | Stable ID; if provided and a toast with this ID exists, it will be updated instead of duplicated |
| `title`    | `Label`             | —                | Optional notification title                                                                      |
| `theme`    | `NotificationTheme` | `"default"`      | Visual theme variant                                                                             |
| `timeout`  | `number`            | Provider default | Override auto-dismiss duration in ms                                                             |
| `closable` | `boolean`           | `true`           | Show close button                                                                                |
| `loading`  | `boolean`           | `false`          | Replaces icon with spinning `Loader2Icon`                                                        |

**Return value — NotificationSubscriber**

| Method    | Description                        |
| --------- | ---------------------------------- |
| `close()` | Dismiss this specific notification |
| `clear()` | Dismiss all visible notifications  |

## Themes

| Value         | Appearance                                                                              |
| ------------- | --------------------------------------------------------------------------------------- |
| `"default"`   | Card background with foreground text                                                    |
| `"info"`      | `bg-alert-info-bg` / `text-alert-info-text` / `border-alert-info-border`                |
| `"success"`   | `bg-alert-success-bg` / `text-alert-success-text` / `border-alert-success-border`       |
| `"warn"`      | `bg-alert-warn-bg` / `text-alert-warn-text` / `border-alert-warn-border`                |
| `"danger"`    | `bg-alert-danger-bg` / `text-alert-danger-text` / `border-alert-danger-border`          |
| `"secondary"` | `bg-alert-secondary-bg` / `text-alert-secondary-text` / `border-alert-secondary-border` |
| `"muted"`     | `bg-alert-muted-bg` / `text-alert-muted-text` / `border-alert-muted-border`             |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                         | CSS Variable             | Purpose                         |
| ----------------------------- | ------------------------ | ------------------------------- |
| `bg-card-background`          | `--card-background`      | Default notification background |
| `border-card-border`          | `--card-border`          | Default notification border     |
| `text-foreground`             | `--foreground`           | Default notification text       |
| `bg-alert-{theme}-bg`         | `--alert-{theme}-bg`     | Themed background               |
| `text-alert-{theme}-text`     | `--alert-{theme}-text`   | Themed text                     |
| `border-alert-{theme}-border` | `--alert-{theme}-border` | Themed border                   |

## Examples

### Basic Notifications

```tsx
function NotificationExamples() {
    const notify = useNotification();

    return (
        <div className="space-y-2">
            <button onClick={() => notify("Default notification")}>Default</button>
            <button onClick={() => notify("Info message", { theme: "info" })}>Info</button>
            <button onClick={() => notify("Success!", { theme: "success" })}>Success</button>
            <button onClick={() => notify("Warning", { theme: "warn" })}>Warning</button>
            <button onClick={() => notify("Error occurred", { theme: "danger" })}>Error</button>
        </div>
    );
}
```

### With Title

```tsx
function SaveButton() {
    const notify = useNotification();

    const handleSave = () => {
        notify("Your changes have been saved to the server.", {
            title: "Changes Saved",
            theme: "success",
            timeout: 3000,
        });
    };

    return <button onClick={handleSave}>Save</button>;
}
```

### Persistent Notification with Manual Close

```tsx
function ProcessButton() {
    const notify = useNotification();

    const startProcess = () => {
        const subscription = notify("Processing your request…", {
            title: "In Progress",
            theme: "info",
            timeout: Infinity,
            closable: false,
            loading: true,
        });

        doWork().then(() => {
            subscription.close();
            notify("Process completed successfully!", { theme: "success" });
        });
    };

    return <button onClick={startProcess}>Start</button>;
}
```

### Form Submission Feedback

```tsx
function ContactForm() {
    const notify = useNotification();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await submitForm();
            notify("Message sent successfully.", { title: "Done", theme: "success" });
        } catch {
            notify("Failed to send. Please try again.", {
                title: "Error",
                theme: "danger",
                timeout: 7000,
            });
        }
    };

    return <form onSubmit={handleSubmit}>{/* fields */}</form>;
}
```

### Updating an Existing Toast

```tsx
const SYNC_ID = "data-sync";
const notify = useNotification();

// Show initial state
notify("Syncing data…", { id: SYNC_ID, theme: "info", timeout: Infinity });

// Update in-place when done
notify("Sync complete.", { id: SYNC_ID, theme: "success", timeout: 3000 });
```

## Do

- Use the correct `theme` to convey message severity (`success`, `danger`, `warn`).
- Keep messages short — toasts are glanced at, not read.
- Use `title` for important notifications that need extra prominence.
- Set a longer `timeout` (or `Infinity`) for critical errors that need user attention.
- Use `loading: true` for in-progress operations to signal activity.

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`) — use `theme` instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`) — override CSS variables in your `@theme` block.
- Don't use notifications for information that must be acknowledged before proceeding — use a `Modal` instead.
- Don't show more than 3–5 notifications at a time; configure `max` accordingly.
- Don't use notifications for persistent status indicators — use `Alert` or a status bar.

## Accessibility

- Built on Base UI Toast which manages ARIA live regions for screen reader announcements.
- Close buttons are keyboard accessible with visible focus states.
- Swipe-to-dismiss works on touch devices via the Base UI primitive.
- The viewport is positioned with `role` semantics handled by the underlying primitive.

## Notes

- Up to 3 notifications are visible by default; hovering the stack reveals all (up to `max`).
- Animations use Framer Motion (`motion/react`) with spring physics for enter/exit.
- The viewport is centered horizontally at the top of the viewport (`top-6`, `z-[100]`).
- When `max` is exceeded, a pill showing `+N more` appears below the visible toasts.
