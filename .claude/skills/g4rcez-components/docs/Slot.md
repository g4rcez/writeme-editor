---
title: Slot
description: A composition primitive that merges its props into a single child element, enabling the asChild pattern.
package: "@g4rcez/components"
export: "{ Slot, Slottable, createSlot, createSlottable }"
import: "import { Slot, Slottable } from '@g4rcez/components'"
category: core
---

# Slot

A composition primitive that merges its props into a single child element. This enables the `asChild` pattern — letting consumers supply their own element while still receiving component-level styles, event handlers, and ARIA attributes. The implementation follows the Radix UI `Slot` pattern.

## Import

```tsx
import { Slot, Slottable } from "@g4rcez/components";
```

## Exports

| Export                       | Description                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `Slot`                       | Merges props into the single child element                                     |
| `Slottable`                  | Marks which child is the slot target when the component has internal structure |
| `createSlot(ownerName)`      | Factory to create a named `Slot` (for building design-system components)       |
| `createSlottable(ownerName)` | Factory to create a named `Slottable`                                          |

## Props

### Slot

| Prop       | Type                                | Default | Description                                                        |
| ---------- | ----------------------------------- | ------- | ------------------------------------------------------------------ |
| `children` | `React.ReactNode`                   | -       | A single valid React element that will receive all of Slot's props |
| `ref`      | `React.ForwardedRef<HTMLElement>`   | -       | Forwarded to the child element                                     |
| `...props` | `React.HTMLAttributes<HTMLElement>` | -       | Props merged into the child                                        |

### Slottable

| Prop       | Type              | Default | Description                              |
| ---------- | ----------------- | ------- | ---------------------------------------- |
| `children` | `React.ReactNode` | -       | The element to render as the slot target |

## Design Tokens

None — `Slot` is a structural/composition primitive that applies no styles of its own. Any classes passed to `Slot` are merged into the child element's `className`.

## How It Works

1. `Slot` receives props and a single child element.
2. It merges `className`, `style`, and event handlers from `Slot`'s own props with those of the child.
3. For event handlers: both the `Slot`'s and the child's handlers are called (child first).
4. For `className`: values are joined with a space.
5. For `style`: `Slot`'s style is spread first, then the child's style overrides.
6. The child's element type is rendered — `Slot` itself renders no DOM element.

## Examples

### The asChild Pattern

```tsx
interface ButtonProps {
  asChild?: boolean;
  children: React.ReactNode;
  className?: string;
}

const StyledButton = ({ asChild, children, ...props }: ButtonProps) => {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className="inline-flex items-center rounded-button-radius bg-button-primary-bg text-button-primary-text px-4 py-2 font-medium"
      {...props}
    >
      {children}
    </Component>
  );
};

// Renders a <button>
<StyledButton>Click me</StyledButton>

// Renders an <a> with all button styles applied
<StyledButton asChild>
  <a href="/dashboard">Go to Dashboard</a>
</StyledButton>
```

### Using Slottable for Internal Structure

When your component wraps children with additional internal elements, use `Slottable` to mark which child is the slot target.

```tsx
import { CheckIcon } from "@phosphor-icons/react";

const IconButton = ({ asChild, children, ...props }: { asChild?: boolean; children: React.ReactNode }) => {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className="inline-flex items-center gap-1.5 rounded-button-radius bg-button-success-bg text-button-success-text px-4 py-2"
      {...props}
    >
      <Slottable>{children}</Slottable>
      <CheckIcon size={14} aria-hidden="true" />
    </Component>
  );
};

// Renders <button> with icon
<IconButton>Confirm</IconButton>

// Renders <a> with icon — the <a> is the slot target
<IconButton asChild>
  <a href="/confirm">Confirm</a>
</IconButton>
```

### Creating a Named Slot

Use `createSlot` when building your own design-system components for better DevTools display names.

```tsx
import { createSlot, createSlottable } from "@g4rcez/components";

const CardSlot = createSlot("Card");
const CardSlottable = createSlottable("Card");
```

### Merging Event Handlers

Both handlers are called when both the `Slot` and the child define the same event.

```tsx
<Slot onClick={() => console.log("slot handler")}>
    <button onClick={() => console.log("child handler")}>Click me</button>
</Slot>
// Logs: "child handler", then "slot handler"
```

## Do

- Use `Slot` when building reusable components that should support any element type via `asChild`
- Use `Slottable` when your component wraps children with internal structure (icons, labels)
- Pass accessibility attributes (`aria-*`, `role`) to `Slot` — they will be merged into the child
- Use design-token classes in the `className` passed to `Slot` (`rounded-button-radius`, `bg-button-primary-bg`)

## Don't

- Don't pass multiple direct children to `Slot` without using `Slottable` — `Slot` expects a single valid element
- Don't use `Slot` when the element type is fixed and will never change
- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`) in `Slot` className — use design tokens
- Don't use arbitrary Tailwind values (`bg-[#abc]`) — override CSS variables in your `@theme` block

## Accessibility

- `Slot` merges `aria-*` and `role` props into the child element transparently
- The final rendered element's semantics depend entirely on the child element type
- Event handlers from both `Slot` and the child are composed — neither is silently dropped

## Data Attributes

- `Slot` and `Slottable` use `displayName` for React DevTools identification but add no DOM attributes
- Any `data-*` attributes passed to `Slot` are merged into the child element

## Notes

- Supports `React.lazy` children via `React.use` when available in the React version
- Ref composition: if both `Slot` and the child have refs, they are composed via `composeRefs`
- `Slottable` uses an internal symbol (`__radixId`) to identify itself — do not attempt to replicate this check
- React Fragment children are supported: the composed ref is not applied to `Fragment` (React 19 compatibility)
