---
title: Polymorph
description: A polymorphic component that renders as any HTML element while maintaining full TypeScript type safety.
package: "@g4rcez/components"
export: "{ Polymorph }"
import: "import { Polymorph } from '@g4rcez/components'"
category: core
---

# Polymorph

A polymorphic component that renders as any HTML element while maintaining full TypeScript type safety. It is the foundational primitive used internally by `Button`, `Tag`, `Heading`, `RenderOnView`, and other components in the library.

## Import

```tsx
import { Polymorph } from "@g4rcez/components";
```

## Props

| Prop       | Type                                | Default  | Description                                      |
| ---------- | ----------------------------------- | -------- | ------------------------------------------------ |
| `as`       | `React.ElementType`                 | `"span"` | The HTML element or React component to render as |
| `ref`      | `React.Ref`                         | -        | Forwarded ref to the rendered element            |
| `...props` | `React.ComponentPropsWithoutRef<T>` | -        | All props valid for the chosen element type      |

## Type Definitions

```tsx
export type PolymorphicProps<Props, T extends React.ElementType> = Props & {
    as?: T;
} & Omit<React.ComponentPropsWithoutRef<T>, keyof Props | "as" | "ref"> & {
        ref?: React.ComponentProps<T>["ref"];
    };
```

## Design Tokens

None — Polymorph itself applies no styles. It is a structural primitive only.

## Examples

### Basic Elements

```tsx
<Polymorph>Default span</Polymorph>

<Polymorph as="button" onClick={() => void 0}>
  Button
</Polymorph>

<Polymorph as="a" href="https://example.com" target="_blank">
  External Link
</Polymorph>
```

### With Refs

```tsx
import { useRef } from "react";

const MyComponent = () => {
    const buttonRef = useRef<HTMLButtonElement>(null);

    return (
        <Polymorph as="button" ref={buttonRef} onClick={() => buttonRef.current?.focus()}>
            Focus Me
        </Polymorph>
    );
};
```

### Conditional Element Type

```tsx
const DynamicItem = ({ isLink, href }: { isLink: boolean; href?: string }) => (
    <Polymorph as={isLink ? "a" : "button"} href={isLink ? href : undefined} className="text-foreground">
        {isLink ? "Visit Link" : "Click Button"}
    </Polymorph>
);
```

### Building Higher-Order Components

```tsx
import { Polymorph, PolymorphicProps } from "@g4rcez/components";

type CardProps<T extends React.ElementType = "div"> = PolymorphicProps<{ variant?: "default" | "muted" }, T>;

const Card = <T extends React.ElementType = "div">({ as, variant = "default", className, ...props }: CardProps<T>) => (
    <Polymorph
        as={as ?? "div"}
        className={`rounded-card-radius border border-border ${variant === "muted" ? "bg-muted" : "bg-card-background"} ${className ?? ""}`}
        {...props}
    />
);
```

### TypeScript Safety

```tsx
// Valid — button accepts type and disabled
<Polymorph as="button" type="submit" disabled />

// Valid — anchor accepts href and target
<Polymorph as="a" href="/link" target="_blank" />

// TypeScript error — href is not valid on button
// <Polymorph as="button" href="/link" />
```

## Do

- Use `Polymorph` as the base when building library components that need element flexibility
- Always provide a meaningful default for `as` in derived components
- Forward refs from your wrapper to `Polymorph` so consumers can access the DOM node
- Use design-token classes for any styling you apply (`text-foreground`, `bg-primary`, etc.)

## Don't

- Don't use `Polymorph` when the element type is fixed and will never change — use the native element directly
- Don't pass raw Tailwind color classes (`text-gray-800`, `bg-blue-500`) when building styled wrappers
- Don't use arbitrary Tailwind values (`text-[#333]`) — override CSS variables in your `@theme` block
- Don't pass props that are invalid for the target element (TypeScript will flag these at compile time)

## Accessibility

- `Polymorph` adds no ARIA attributes of its own — the rendered element's semantics are determined by the `as` prop
- When `as="button"` is omitted and you need interactive behavior, prefer `as="button"` over `as="div"` with an `onClick`
- Refs are forwarded correctly, enabling programmatic focus management

## Data Attributes

- No data attributes are set by `Polymorph` itself
- Components built on top of `Polymorph` (e.g., `Button`, `Tag`) add their own `data-component` attribute

## Notes

- The default element is `<span>` when no `as` prop is provided
- The `as` prop is stripped before forwarding to the DOM element to prevent unknown attribute warnings
- Refs are forwarded via `React.forwardRef`
- `PolymorphicProps` is exported and can be used to type custom components built on `Polymorph`
