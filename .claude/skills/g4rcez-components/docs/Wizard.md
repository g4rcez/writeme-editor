---
title: Wizard
description: Guided tour overlay that highlights page elements step-by-step with animated SVG masking and floating tooltips.
package: "@g4rcez/components"
export: "{ Wizard }"
import: "import { Wizard } from '@g4rcez/components'"
category: floating
---

# Wizard

Guided tour overlay that highlights page elements step-by-step with animated SVG masking and floating tooltips.

## Import

```tsx
import { Wizard } from "@g4rcez/components";
```

## Props

### Wizard

| Prop       | Type                                                                   | Default | Description                                        |
| ---------- | ---------------------------------------------------------------------- | ------- | -------------------------------------------------- |
| `active`   | `boolean`                                                              | `false` | Controls whether the wizard is visible             |
| `steps`    | `WizardStep[]`                                                         | —       | Ordered array of step configurations               |
| `onClose`  | `() => void`                                                           | —       | Callback when the user skips or dismisses the tour |
| `onFinish` | `() => void`                                                           | —       | Callback when the last step is completed           |
| `onChange` | `(index: number) => void`                                              | —       | Callback fired when the step index changes         |
| `labels`   | `{ next?: string; skip?: string; finish?: string; previous?: string }` | —       | Override button labels                             |

### WizardStep

| Prop          | Type                                                    | Default    | Description                                             |
| ------------- | ------------------------------------------------------- | ---------- | ------------------------------------------------------- |
| `element`     | `string \| Element \| React.RefObject<Element \| null>` | —          | Target element: CSS selector, DOM element, or React ref |
| `title`       | `React.ReactNode`                                       | —          | Step title displayed in the tooltip                     |
| `description` | `React.ReactNode`                                       | —          | Step body content                                       |
| `side`        | `Placement`                                             | `"bottom"` | Tooltip placement relative to the target element        |
| `onEnter`     | `() => void`                                            | —          | Called when this step becomes active                    |
| `onNext`      | `() => void`                                            | —          | Called before advancing to the next step                |
| `onPrevious`  | `() => void`                                            | —          | Called before going back to the previous step           |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                    | CSS Variable            | Purpose                                     |
| ------------------------ | ----------------------- | ------------------------------------------- |
| `text-floating-overlay`  | `--floating-overlay`    | SVG mask fill color (`/70` opacity applied) |
| `bg-floating-background` | `--floating-background` | Step tooltip surface background             |
| `border-floating-border` | `--floating-border`     | Step tooltip border and footer divider      |
| `z-wizard`               | `--z-wizard`            | Z-index for the overlay layer               |
| `z-floating`             | `--z-floating`          | Z-index for the step tooltip                |
| `text-muted-foreground`  | `--muted-foreground`    | Step counter and skip button text           |
| `text-foreground`        | `--foreground`          | Skip button hover text                      |

## Examples

### Basic Two-Step Tour

```tsx
import { useState } from "react";
import { Wizard } from "@g4rcez/components";
import { Button } from "@g4rcez/components/button";

function OnboardingTour() {
    const [active, setActive] = useState(false);

    const steps = [
        {
            element: "#create-button",
            title: "Create something new",
            description: "Use this button to create a new project.",
            side: "bottom" as const,
        },
        {
            element: "#notifications-bell",
            title: "Stay up to date",
            description: "Check here for the latest updates.",
            side: "left" as const,
        },
    ];

    return (
        <>
            <Button onClick={() => setActive(true)}>Start Tour</Button>

            <Wizard
                active={active}
                steps={steps}
                onClose={() => setActive(false)}
                onFinish={() => {
                    setActive(false);
                    console.log("Tour complete");
                }}
            />
        </>
    );
}
```

### Using Refs as Targets

```tsx
import { useRef, useState } from "react";
import { Wizard } from "@g4rcez/components";
import { Button } from "@g4rcez/components/button";

function RefTour() {
    const [active, setActive] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const steps = [
        {
            element: buttonRef,
            title: "Action Button",
            description: "Click here to perform the primary action.",
            side: "right" as const,
        },
    ];

    return (
        <>
            <Button ref={buttonRef} theme="primary">
                Primary Action
            </Button>

            <Wizard active={active} steps={steps} onClose={() => setActive(false)} labels={{ finish: "Got it!", skip: "No thanks" }} />
        </>
    );
}
```

### Step Lifecycle Callbacks

```tsx
const steps = [
    {
        element: "#dashboard-chart",
        title: "Your Analytics",
        description: "This chart shows activity for the last 30 days.",
        onEnter: () => console.log("User reached analytics step"),
        onNext: () => console.log("User advancing past analytics"),
    },
    {
        element: "#export-button",
        title: "Export Data",
        description: "Download your data at any time.",
        side: "left" as const,
    },
];
```

### Custom Labels

```tsx
<Wizard
    active={active}
    steps={steps}
    onClose={() => setActive(false)}
    onFinish={() => setActive(false)}
    labels={{
        next: "Continue",
        previous: "Back",
        skip: "Skip tour",
        finish: "Done",
    }}
/>
```

## Do

- Keep tours to 3–7 steps; fewer steps are completed more often.
- Ensure target elements are visible in the viewport when each step activates — the wizard scrolls to them automatically.
- Always provide `onClose` so users can exit at any time without completing the tour.
- Use `onEnter` to trigger any side effects that make the target element visible (e.g., open a panel) before the step highlights it.

## Don't

- Don't use the wizard for critical information that isn't accessible elsewhere — some users will skip it.
- Don't pass more than ~10 steps; tours that feel long are abandoned.
- Don't block users from navigating if they skip the wizard.
- Don't pass raw Tailwind color classes in `title` or `description` content — use design-token classes.
- Don't use arbitrary Tailwind values (`z-[9999]`) — the wizard already uses `z-wizard`; override the CSS variable if needed.

## Accessibility

- The wizard renders in a `FloatingPortal` above all other content.
- The SVG mask highlights the target element using `pointer-events-auto` so users can interact with it during the tour.
- Navigation buttons use the `Button` component and are keyboard accessible.
- Step progress is shown as `{current} / {total}` in the tooltip corner.
- The `FloatingArrow` provides a visual pointer connecting the tooltip to the target element.

## Data Attributes

| Attribute                 | Applied to            | Description                        |
| ------------------------- | --------------------- | ---------------------------------- |
| `data-component="wizard"` | Main wizard container | Identifies the wizard overlay root |

## Notes

- The SVG mask uses a `<motion.rect>` that animates to the target element's bounding rect with a spring transition. The tooltip appears only after the animation completes (`onAnimationComplete`).
- The overlay is `pointer-events-none` except for the mask rect, which is `pointer-events-auto` — this allows clicking the highlighted element while the tour is active.
- When `element` resolves to `null` (selector not found or ref is empty), the tooltip centers on the screen and a console warning is emitted.
- `useResizeObserver` and scroll/resize event listeners keep the highlight rect in sync as the layout changes.
- The `labels` prop values fall back to the global translations provided by `useTranslations`.
