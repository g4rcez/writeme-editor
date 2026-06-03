---
title: TaskList
description: Fieldset container that triggers a celebratory animation when all child tasks are checked.
package: "@g4rcez/components"
export: "{ TaskList }"
import: "import { TaskList } from '@g4rcez/components/task-list'"
category: form
---

# TaskList

Fieldset container that triggers a celebratory animation when all child tasks are checked.

## Import

```tsx
import { TaskList } from "@g4rcez/components/task-list";
import { Checkbox } from "@g4rcez/components/checkbox";
```

## Props

Accepts all standard HTML `<fieldset>` attributes.

| Prop        | Type              | Default | Description                                   |
| ----------- | ----------------- | ------- | --------------------------------------------- |
| `children`  | `React.ReactNode` | —       | `Checkbox` components with the `asTask` prop. |
| `className` | `string`          | —       | Additional CSS classes for the `<fieldset>`.  |

## Design Tokens

`TaskList` itself is a plain `<fieldset>` and inherits ambient tokens from its children. No component-scoped tokens are consumed directly. Style the container using semantic tokens:

| Token             | CSS Variable   | Purpose                               |
| ----------------- | -------------- | ------------------------------------- |
| `border-border`   | `--border`     | Optional border around the task group |
| `bg-background`   | `--background` | Container background                  |
| `text-foreground` | `--foreground` | Task label text                       |

## Examples

### Basic task list

```tsx
import { TaskList } from "@g4rcez/components/task-list";
import { Checkbox } from "@g4rcez/components/checkbox";

export default function OnboardingChecklist() {
    return (
        <TaskList className="flex flex-col gap-sm border border-border rounded-card-radius p-4">
            <Checkbox asTask>Complete initial setup</Checkbox>
            <Checkbox asTask>Upload profile picture</Checkbox>
            <Checkbox asTask>Verify email address</Checkbox>
        </TaskList>
    );
}
```

### Dynamic tasks from state

```tsx
import { useState } from "react";
import { TaskList } from "@g4rcez/components/task-list";
import { Checkbox } from "@g4rcez/components/checkbox";

type Task = { id: string; text: string; done: boolean };

export default function DynamicTaskList({ tasks }: { tasks: Task[] }) {
    const [items, setItems] = useState(tasks);

    const toggle = (id: string) => setItems((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

    return (
        <TaskList className="flex flex-col gap-sm">
            {items.map((task) => (
                <Checkbox key={task.id} asTask checked={task.done} onChange={() => toggle(task.id)}>
                    {task.text}
                </Checkbox>
            ))}
        </TaskList>
    );
}
```

### Grouped tasks with a legend

```tsx
import { TaskList } from "@g4rcez/components/task-list";
import { Checkbox } from "@g4rcez/components/checkbox";

export default function ProjectSubtasks() {
    return (
        <TaskList className="flex flex-col gap-sm rounded-card-radius border border-border p-4">
            <legend className="px-1 text-sm font-medium text-foreground">Phase 1 — Design</legend>
            <Checkbox asTask>Create wireframes</Checkbox>
            <Checkbox asTask>Review with stakeholders</Checkbox>
            <Checkbox asTask>Export design tokens</Checkbox>
        </TaskList>
    );
}
```

## Do

- Use `asTask` on every `Checkbox` inside `TaskList` so they are counted for the completion animation.
- Group closely related tasks — the animation is most meaningful when all items belong to one milestone.
- Provide adequate vertical spacing between items (`gap-sm`, `gap-base`) for readability.
- Use design-token classes for wrappers (`bg-background`, `border-border`, `rounded-card-radius`).

## Don't

- Don't use `TaskList` for checkboxes that are not tasks (e.g., bulk-selection rows in a table).
- Don't pack too many unrelated tasks into a single list; split them into smaller groups.
- Don't pass raw Tailwind color classes (`bg-gray-100`, `border-gray-300`) — use design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`) — override CSS variables in your `@theme` block instead.

## Accessibility

- Renders a semantic `<fieldset>` to group related inputs — pair with a `<legend>` for a fully accessible group label.
- Inherits all accessibility features of the underlying `Checkbox` component.
- The completion animation (scale + rotate) is visual-only and does not alter keyboard or screen-reader behavior.

## Data Attributes

| Attribute        | Element       | Value         | Description                                                                                                              |
| ---------------- | ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `data-component` | `fieldset`    | `"task-list"` | Identifies the component.                                                                                                |
| `data-task`      | child `input` | `"true"`      | Must be present on child checkbox inputs for them to be counted in the completion check. Set automatically via `asTask`. |

## Notes

- The animation is powered by `motion/react`. When all `input[data-task=true]` elements inside the fieldset are checked, a staggered scale + rotate animation fires starting from the last-checked item's index.
- `TaskList` attaches a single `change` event listener on the `<fieldset>` (event delegation) — no per-item wiring is required.
- The animation runs once per "all complete" event; unchecking an item and re-checking to completion will replay it.
