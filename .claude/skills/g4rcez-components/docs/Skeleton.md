---
title: Skeleton
description: Animated loading placeholder components for content that is being fetched.
package: "@g4rcez/components"
export: "{ Skeleton, SkeletonCell, SkeletonList }"
import: "import { Skeleton, SkeletonCell, SkeletonList } from '@g4rcez/components'"
category: display
---

# Skeleton

Animated loading placeholder components for content that is being fetched.

## Import

```tsx
import { Skeleton, SkeletonCell, SkeletonList } from "@g4rcez/components";
```

## Components

### SkeletonCell

A pre-built table-cell skeleton with `h-6 w-10/12 animate-pulse rounded bg-muted`. Renders as a plain `<div>` (no props).

### Skeleton

A configurable block skeleton.

| Prop        | Type                | Default  | Description                             |
| ----------- | ------------------- | -------- | --------------------------------------- |
| `className` | `string`            | —        | Override or extend dimensions and shape |
| `as`        | `React.ElementType` | `"span"` | Polymorphic root element                |
| `style`     | `CSSProperties`     | —        | Inline styles (e.g. dynamic `width`)    |

Default appearance: `block h-8 w-32 animate-pulse rounded bg-muted`.

### SkeletonList

A vertical list of randomized-width `Skeleton` lines.

| Prop        | Type     | Default | Description                                 |
| ----------- | -------- | ------- | ------------------------------------------- |
| `rows`      | `number` | —       | Number of skeleton lines to render          |
| `className` | `string` | —       | Additional classes for the `<ul>` container |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token      | CSS Variable | Purpose                                              |
| ---------- | ------------ | ---------------------------------------------------- |
| `bg-muted` | `--muted`    | Pulse animation background for all skeleton variants |

## Examples

### Table Loading Skeleton

```tsx
function TableSkeleton() {
    return (
        <table className="w-full">
            <tbody>
                {Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="border-b border-border">
                        <td className="py-3 px-4">
                            <SkeletonCell />
                        </td>
                        <td className="py-3 px-4">
                            <SkeletonCell />
                        </td>
                        <td className="py-3 px-4">
                            <SkeletonCell />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
```

### Card Loading Skeleton

```tsx
function CardSkeleton() {
    return (
        <div className="rounded-card-radius border border-card-border bg-card-background p-6 space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <div className="space-y-2">
                <SkeletonCell />
                <SkeletonCell />
                <Skeleton className="h-2 w-1/2" />
            </div>
            <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-16" />
            </div>
        </div>
    );
}
```

### List Loading Skeleton

```tsx
<SkeletonList rows={5} className="px-4" />
```

### Conditional Skeleton

```tsx
function DataSection({ data, loading }: { data?: Item; loading: boolean }) {
    return <div>{loading ? <Skeleton className="h-6 w-full" /> : <p>{data?.name}</p>}</div>;
}
```

### Avatar + Text Row Skeleton

```tsx
function UserRowSkeleton() {
    return (
        <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-1">
                <SkeletonCell />
                <Skeleton className="h-2 w-1/3" />
            </div>
        </div>
    );
}
```

## Do

- Design skeletons that closely match the dimensions of the real content to minimize layout shift.
- Use `animate-pulse` (applied by default) to signal that the system is active.
- Use `SkeletonList` for simple vertically stacked text content.
- Wrap skeleton containers with `aria-live="polite"` so screen readers announce when real content loads.

## Don't

- Don't pass raw Tailwind color classes (`bg-gray-200`, `bg-slate-300`) as `className` — use `bg-muted` or other design-token classes instead.
- Don't use arbitrary Tailwind values (`bg-[#ddd]`) — override CSS variables in your `@theme` block.
- Don't show skeletons for very short loading states (under ~300 ms) — it causes visual flicker.
- Don't make skeletons too detailed; simple geometric shapes are most effective.
- Don't use skeletons for error states — show `Empty` or `Alert` instead.

## Accessibility

- Skeleton components are purely decorative; they carry no ARIA roles.
- Add `aria-live="polite"` to the container that transitions from skeleton to real content so assistive technologies announce the change.
- Consider `aria-label="Loading content"` on the skeleton container for additional context.

```tsx
<div aria-live="polite">{loading ? <SkeletonCell /> : <ActualContent />}</div>
```

## Notes

- `SkeletonList` generates random widths at mount time (via `Math.random()`) so each row looks distinct. Widths are stable across re-renders thanks to `useRef`.
- `Skeleton` uses `as="span"` by default, making it safe to use inside inline contexts. Change `as` to `"div"` or `"li"` as needed.
