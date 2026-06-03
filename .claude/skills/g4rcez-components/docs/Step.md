---
title: Step
description: Animated multi-step progress indicator with status tracking for checkout flows, onboarding, and wizards.
package: "@g4rcez/components"
export: "{ Step }"
import: "import { Steps, Step } from '@g4rcez/components'"
category: display
---

# Step

Animated multi-step progress indicator with status tracking for checkout flows, onboarding, and wizards.

## Import

```tsx
import { Steps, Step } from "@g4rcez/components";
```

## Props

### Steps (Container)

| Prop          | Type              | Default | Description                        |
| ------------- | ----------------- | ------- | ---------------------------------- |
| `currentStep` | `number`          | —       | Index of the currently active step |
| `steps`       | `number`          | —       | Total number of steps              |
| `children`    | `React.ReactNode` | —       | `Step` components                  |

### Step

| Prop             | Type         | Default | Description                                                                   |
| ---------------- | ------------ | ------- | ----------------------------------------------------------------------------- |
| `step`           | `number`     | —       | Index of this step                                                            |
| `currentStep`    | `number`     | —       | Index of the currently active step (usually from parent)                      |
| `title`          | `Label`      | —       | Step label                                                                    |
| `status`         | `StepStatus` | —       | Override automatic status (`"active" \| "inactive" \| "complete" \| "error"`) |
| `titleClassName` | `string`     | —       | Additional classes for the title text                                         |

Standard `<button>` props are also forwarded (e.g. `onClick`, `disabled`).

## Step Statuses

| Status     | Visual             | Icon                |
| ---------- | ------------------ | ------------------- |
| `active`   | Primary color ring | Step number         |
| `inactive` | Muted border       | Step number         |
| `complete` | Success color fill | Animated check mark |
| `error`    | Danger color fill  | Animated X mark     |

Status is derived automatically from `step` vs. `currentStep` unless overridden via `status`.

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                                   | CSS Variable                          | Purpose                            |
| --------------------------------------- | ------------------------------------- | ---------------------------------- |
| `bg-primary` / `border-primary`         | `--primary-DEFAULT`                   | Active step fill and border        |
| `text-primary-foreground`               | `--primary-foreground`                | Active step text                   |
| `bg-success` / `border-success`         | `--success-DEFAULT`                   | Complete step fill and border      |
| `text-success-foreground`               | `--success-foreground`                | Complete step check icon           |
| `bg-danger` / `border-danger`           | `--danger-DEFAULT` / `--danger-hover` | Error step fill and border         |
| `text-danger-foreground`                | `--danger-foreground`                 | Error step X icon                  |
| `text-disabled`                         | `--disabled`                          | Inactive step text                 |
| `bg-card-border` / `border-card-border` | `--card-border`                       | Connector line and inactive border |
| `bg-background`                         | `--background`                        | Inactive step background           |

## Examples

### Basic Steps

```tsx
<Steps currentStep={2} steps={3}>
    <Step step={1} currentStep={2} title="Account" />
    <Step step={2} currentStep={2} title="Profile" />
    <Step step={3} currentStep={2} title="Review" />
</Steps>
```

### Interactive Wizard

```tsx
function Wizard() {
    const [currentStep, setCurrentStep] = useState(1);

    return (
        <div className="space-y-8">
            <Steps currentStep={currentStep} steps={4}>
                <Step step={1} currentStep={currentStep} title="Account" onClick={() => setCurrentStep(1)} />
                <Step step={2} currentStep={currentStep} title="Profile" onClick={() => setCurrentStep(2)} />
                <Step step={3} currentStep={currentStep} title="Payment" onClick={() => setCurrentStep(3)} />
                <Step step={4} currentStep={currentStep} title="Review" onClick={() => setCurrentStep(4)} />
            </Steps>

            <div className="p-6 rounded-card-radius border border-card-border bg-card-background">
                {currentStep === 1 && <AccountForm />}
                {currentStep === 2 && <ProfileForm />}
                {currentStep === 3 && <PaymentForm />}
                {currentStep === 4 && <ReviewSummary />}
            </div>
        </div>
    );
}
```

### With Error State

```tsx
<Steps currentStep={2} steps={3}>
    <Step step={1} currentStep={2} title="Identity" />
    <Step step={2} currentStep={2} title="Payment" status="error" />
    <Step step={3} currentStep={2} title="Finish" />
</Steps>
```

### Checkout Flow

```tsx
function CheckoutSteps({ step }: { step: number }) {
    return (
        <Steps currentStep={step} steps={3}>
            <Step step={1} currentStep={step} title="Cart" />
            <Step step={2} currentStep={step} title="Shipping" />
            <Step step={3} currentStep={step} title="Confirmation" />
        </Steps>
    );
}
```

## Do

- Provide clear, concise `title` labels for each step.
- Keep the total number of steps manageable (3–5 is ideal).
- Use `status="error"` to clearly indicate where a user needs to return and fix a problem.
- Use `onClick` on `Step` to enable backward navigation in wizards.

## Don't

- Don't pass raw Tailwind color classes for step styling — the component derives colors from CSS variables.
- Don't use arbitrary Tailwind values (`bg-[#abc]`) — override CSS variables in your `@theme` block.
- Don't hide critical information in steps the user hasn't yet seen.
- Don't use `Step` for non-linear navigation without a clear sequential intent.

## Accessibility

- Each `Step` renders as a `<button>` element, making it focusable and keyboard-operable.
- Icons use `aria-hidden` to prevent redundant screen reader announcements.
- The `Steps` container provides a logical visual grouping for the process.

## Data Attributes

- `data-step` — the step index number, applied to each step's `<button>`.

## Notes

- Connector lines between steps are shown only on `xl` breakpoints (hidden on smaller screens where steps stack vertically).
- Animations use Framer Motion (`motion/react`): the step circle animates between status colors, and the check/X icons draw in with `pathLength`.
- The `Steps` component tracks `previousStep` internally to orchestrate staggered transition delays when jumping multiple steps at once.
