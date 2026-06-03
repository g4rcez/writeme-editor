---
title: RenderOnView
description: A performance wrapper that defers rendering children until the container enters the viewport.
package: "@g4rcez/components"
export: "{ RenderOnView }"
import: "import { RenderOnView } from '@g4rcez/components'"
category: core
---

# RenderOnView

A performance wrapper that defers rendering its children until the container element enters the viewport. Uses the `IntersectionObserver` API and renders children exactly once — they stay mounted after first appearing.

## Import

```tsx
import { RenderOnView } from "@g4rcez/components";
```

## Props

| Prop             | Type                                | Default | Description                                                      |
| ---------------- | ----------------------------------- | ------- | ---------------------------------------------------------------- |
| `onIntersection` | `() => void`                        | -       | Callback fired once when the container first enters the viewport |
| `children`       | `React.ReactNode`                   | -       | Content to render when the container is visible                  |
| `as`             | `React.ElementType`                 | `"div"` | HTML element to render the container as                          |
| `...props`       | `React.ComponentPropsWithoutRef<T>` | -       | All props valid for the chosen element type                      |

## Design Tokens

None — `RenderOnView` is a layout/performance primitive that applies no styles of its own.

## How It Works

1. **Initial state**: The container element renders immediately but children are not mounted.
2. **Intersection Observer**: A `useLayoutEffect` sets up an `IntersectionObserver` on the container.
3. **First intersection**: When the container enters the viewport, `shouldRender` flips to `true` and children mount.
4. **Stays mounted**: Children remain in the DOM after the first intersection — scrolling back out does not unmount them.
5. **Callback**: `onIntersection` fires once at the moment of the first intersection.

## Examples

### Basic Lazy Rendering

```tsx
<div>
    <div className="h-screen flex items-center justify-center text-foreground">Scroll down to see lazy content</div>

    <RenderOnView>
        <ExpensiveChart data={largeDataset} />
    </RenderOnView>
</div>
```

### With Intersection Callback

```tsx
const TrackableSection = ({ sectionName, children }: { sectionName: string; children: React.ReactNode }) => (
    <RenderOnView onIntersection={() => analytics.track("Section Viewed", { section: sectionName })}>{children}</RenderOnView>
);
```

### Multiple Deferred Sections

```tsx
<main>
    <HeroSection />

    <RenderOnView>
        <FeaturesSection />
    </RenderOnView>

    <RenderOnView>
        <TestimonialsSection />
    </RenderOnView>

    <RenderOnView>
        <ContactForm />
    </RenderOnView>
</main>
```

### With Custom Element

```tsx
<RenderOnView as="section" aria-label="Analytics charts">
    <RevenueChart />
</RenderOnView>
```

### With React.lazy and Suspense

```tsx
import { lazy, Suspense } from "react";
import { Spinner } from "@g4rcez/components";

const HeavyComponent = lazy(() => import("./HeavyComponent"));

<RenderOnView>
    <Suspense fallback={<Spinner />}>
        <HeavyComponent />
    </Suspense>
</RenderOnView>;
```

## Do

- Use `RenderOnView` for components with significant rendering cost (charts, maps, rich editors)
- Combine with `React.lazy` and `Suspense` for maximum bundle and rendering savings
- Use `as="section"` or another semantic element when the container has meaningful structure
- Use design-token classes on wrapper divs inside children (`bg-background`, `border-border`)

## Don't

- Don't use `RenderOnView` for above-the-fold content — it adds an unnecessary observer
- Don't rely on it for critical content that must be in the initial HTML (SEO, LCP elements)
- Don't pass raw Tailwind color classes (`bg-white`, `text-gray-800`) to children or wrappers — use design tokens
- Don't use arbitrary Tailwind values (`bg-[#abc]`) — override CSS variables in your `@theme` block

## Accessibility

- The container element is always rendered and present in the DOM
- Children mount only when visible, so screen readers will encounter them when they scroll into view
- Ensure any interactive content inside has proper focus management after mounting

## Notes

- Children render exactly once and are never unmounted, regardless of subsequent scroll position
- `onIntersection` fires at most once per component lifetime
- The `IntersectionObserver` is disconnected on component unmount
- Uses `useLayoutEffect` for synchronous observer setup to avoid a flash of empty container
- SSR-safe: the initial `shouldRender` state starts as `false` since `ref.current` is `null` on the server
