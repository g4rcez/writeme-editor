---
title: Empty
description: Empty state placeholder displayed when a collection or data set contains no items.
package: "@g4rcez/components"
export: "{ Empty }"
import: "import { Empty } from '@g4rcez/components'"
category: display
---

# Empty

Empty state placeholder displayed when a collection or data set contains no items.

## Import

```tsx
import { Empty } from "@g4rcez/components";
```

## Props

| Prop      | Type     | Default                       | Description                        |
| --------- | -------- | ----------------------------- | ---------------------------------- |
| `Icon`    | `Icon`   | `FileIcon`                    | Phosphor icon component to display |
| `message` | `string` | Localized "No data available" | Descriptive empty state message    |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token           | CSS Variable | Purpose                     |
| --------------- | ------------ | --------------------------- |
| `text-disabled` | `--disabled` | Icon and message text color |

## Examples

### Default Empty State

```tsx
<Empty />
```

### Custom Message and Icon

```tsx
import { MagnifyingGlassMinusIcon } from "@phosphor-icons/react";

<Empty Icon={MagnifyingGlassMinusIcon} message="No results found" />;
```

### In a Data Table

```tsx
import { DatabaseIcon } from "@phosphor-icons/react";

function DataTable({ data }: { data: Item[] }) {
    if (data.length === 0) {
        return (
            <div className="py-12">
                <Empty Icon={DatabaseIcon} message="No records found" />
            </div>
        );
    }

    return <table>{/* table content */}</table>;
}
```

### In a List

```tsx
import { TrayIcon } from "@phosphor-icons/react";

function TaskList({ tasks }: { tasks: Task[] }) {
    return (
        <div className="space-y-4">
            <h2>My Tasks</h2>

            {tasks.length === 0 ? (
                <Empty Icon={TrayIcon} message="No tasks yet" />
            ) : (
                <ul>
                    {tasks.map((task) => (
                        <TaskItem key={task.id} task={task} />
                    ))}
                </ul>
            )}
        </div>
    );
}
```

### With an Action

```tsx
import { Button } from "@g4rcez/components/button";
import { FolderPlusIcon } from "@phosphor-icons/react";

function EmptyProjectsList() {
    return (
        <div className="text-center py-12">
            <Empty Icon={FolderPlusIcon} message="You haven't created any projects yet" />
            <div className="mt-6">
                <Button theme="primary" onClick={handleCreate}>
                    Create Your First Project
                </Button>
            </div>
        </div>
    );
}
```

### Contextual Icons

```tsx
import {
  ShoppingCartIcon,
  HeartIcon,
  BellIcon,
  MailIcon,
} from "@phosphor-icons/react";

// Cart
<Empty Icon={ShoppingCartIcon} message="Your cart is empty" />

// Favorites
<Empty Icon={HeartIcon} message="No favorites yet" />

// Notifications
<Empty Icon={BellIcon} message="No notifications" />

// Messages
<Empty Icon={MailIcon} message="No messages" />
```

## Do

- Provide a clear, encouraging message that tells users what is missing.
- Use an icon that is contextually relevant to the missing content type.
- Pair `Empty` with an action button when the user can resolve the empty state.
- Wrap `Empty` in a padded container for visual breathing room.

## Don't

- Don't pass raw Tailwind color classes (`text-gray-400`) for the icon — the component uses `text-disabled` from the design system.
- Don't use arbitrary Tailwind values (`text-[#abc]`) — override CSS variables in your `@theme` block instead.
- Don't use `Empty` for transient loading states — use `Skeleton` or `Spinner` instead.
- Don't leave a blank space when data is missing; always provide visual feedback.
- Don't use overly technical language in the empty state message.

## Accessibility

- The icon renders at `size={64}` using a Phosphor component which includes accessible SVG markup.
- The message uses a `<p>` element for semantic text.
- Both icon and text use `text-disabled` ensuring sufficient contrast against the background.

## Notes

- The default message is sourced from the active locale translations via `useTranslations()`, so it localizes automatically when the app locale changes.
- To override the default message permanently, pass an explicit `message` prop.
