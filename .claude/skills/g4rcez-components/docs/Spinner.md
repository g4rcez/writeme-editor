---
title: Spinner
description: Animated loading indicator for unknown-duration operations, available as an inline Spinner or a full-container Loading wrapper.
package: "@g4rcez/components"
export: "{ Spinner, Loading }"
import: "import { Spinner, Loading } from '@g4rcez/components'"
category: display
---

# Spinner

Animated loading indicator for unknown-duration operations, available as an inline `Spinner` or a full-container `Loading` wrapper.

## Import

```tsx
import { Spinner, Loading } from "@g4rcez/components";
```

## Props

### Spinner

| Prop        | Type     | Default | Description                                            |
| ----------- | -------- | ------- | ------------------------------------------------------ |
| `className` | `string` | —       | Additional classes to customize size, color, or border |

Default appearance: `size-12 border-4 border-background border-b-primary animate-spin rounded-full`.

### Loading

No props. Renders a centered `Spinner` inside a `flex h-full w-full items-center justify-center p-12` container.

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token               | CSS Variable   | Purpose                     |
| ------------------- | -------------- | --------------------------- |
| `border-background` | `--background` | Inactive spinner ring color |
| `border-b-primary`  | `--primary`    | Active spinner arc color    |

## Examples

### Default Spinner

```tsx
<Spinner />
```

### Full-Container Loading State

```tsx
{
    isLoading ? <Loading /> : <Content />;
}
```

### Custom Size

```tsx
<Spinner className="size-6 border-2" />
```

### Spinner Inside a Button

```tsx
<button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-button-radius">
    {isSubmitting && <Spinner className="size-4 border-2 border-primary-foreground border-b-transparent" />}
    {isSubmitting ? "Saving…" : "Save"}
</button>
```

### Centered in a Card

```tsx
import { Card } from "@g4rcez/components/card";

<Card title="Analytics">
    <div className="h-64 flex items-center justify-center">
        <Spinner />
    </div>
</Card>;
```

### Lazy Component Fallback

```tsx
import { Suspense } from "react";
import { Loading } from "@g4rcez/components";

<Suspense fallback={<Loading />}>
    <HeavyComponent />
</Suspense>;
```

## Do

- Use `Loading` for full-page or large-section loading states where the parent already has a defined height.
- Use `Spinner` inline (e.g. inside buttons) when an action is being processed.
- Ensure the parent container of `Loading` has a defined height so the spinner centers correctly.
- Provide a relevant `aria-label` or `aria-description` if the Portuguese default ("Carregando...") is not appropriate.

## Don't

- Don't pass raw Tailwind color classes (`border-blue-500`) for the spinner border — use design tokens (`border-primary`) instead.
- Don't use arbitrary Tailwind values (`border-[#abc]`) — override CSS variables in your `@theme` block.
- Don't leave a `Spinner` visible indefinitely; always handle error states or timeouts.
- Don't render many spinners simultaneously on a single screen — it is visually disorienting.

## Accessibility

- `Spinner` includes `aria-busy="true"` and `aria-description="Carregando..."` so assistive technologies know content is loading.
- For non-Portuguese applications, pass a `className` and wrap with a visually hidden `<span aria-live="polite">` if you need a localized announcement.

## Notes

- The spinning effect comes from Tailwind's `animate-spin` utility (`animation: spin 1s linear infinite`).
- The arc effect is achieved via `border-background` for the full ring and `border-b-primary` for the colored arc — one border property per side.
- `Loading` is a thin wrapper; prefer `Loading` over manually composing `flex items-center justify-center` wrappers every time.
