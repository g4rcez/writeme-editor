---
title: Progress
description: Accessible progress bar built on Base UI Progress with optional label overlay and smooth transitions.
package: "@g4rcez/components"
export: "{ Progress }"
import: "import { Progress } from '@g4rcez/components'"
category: display
---

# Progress

Accessible progress bar built on Base UI Progress with optional label overlay and smooth transitions.

## Import

```tsx
import { Progress } from "@g4rcez/components";
```

## Props

| Prop            | Type     | Default | Description                                              |
| --------------- | -------- | ------- | -------------------------------------------------------- |
| `percent`       | `number` | —       | Current progress value (0–100)                           |
| `max`           | `number` | —       | Maximum value (forwarded to Base UI `Progress.Root`)     |
| `label`         | `Label`  | —       | Custom text overlay; overrides the default `{percent} %` |
| `container`     | `string` | —       | Additional classes for the track element                 |
| `className`     | `string` | —       | Additional classes for the indicator (fill) element      |
| `textClassName` | `string` | —       | Additional classes for the label text overlay            |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                     | CSS Variable           | Purpose                     |
| ------------------------- | ---------------------- | --------------------------- |
| `bg-background`           | `--background`         | Track (unfilled) background |
| `bg-primary`              | `--primary`            | Indicator (fill) color      |
| `text-primary-foreground` | `--primary-foreground` | Default label text color    |

## Examples

### Basic Progress Bar

```tsx
<Progress percent={75} />
```

### Animated Progress

```tsx
function AnimatedProgress() {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress((prev) => (prev >= 100 ? 0 : prev + 10));
        }, 500);
        return () => clearInterval(timer);
    }, []);

    return <Progress percent={progress} />;
}
```

### Custom Label

```tsx
<Progress percent={60} label="Uploading file… 60%" />
```

### Indeterminate / Unknown Duration

When `percent` is `undefined` the indicator is not rendered and the label is hidden, leaving only the track. Combine with a separate `Spinner` for unknown-duration operations.

```tsx
{
    isLoading ? <Spinner /> : <Progress percent={uploadPercent} />;
}
```

### Multi-Step Form Progress

```tsx
function MultiStepForm() {
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 4;
    const progress = (currentStep / totalSteps) * 100;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>
                    Step {currentStep} of {totalSteps}
                </span>
                <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress percent={progress} />
        </div>
    );
}
```

### Upload with Status Label

```tsx
function FileUploadProgress({ fileName, percent }: { fileName: string; percent: number }) {
    const isDone = percent >= 100;

    return (
        <div className="space-y-1">
            <div className="flex justify-between text-sm">
                <span className="text-foreground">{fileName}</span>
                <span className="text-muted-foreground">{percent}%</span>
            </div>
            <Progress
                percent={percent}
                label={isDone ? "Complete" : undefined}
                container={isDone ? "bg-success/20" : undefined}
                className={isDone ? "bg-success" : undefined}
            />
        </div>
    );
}
```

## Do

- Use `Progress` when the duration of an operation is known or can be estimated.
- Provide a `label` when a percentage alone is not descriptive enough.
- Use `container` and `className` with design-token classes to change the track and fill colors (`bg-success`, `bg-warn`, etc.).

## Don't

- Don't pass raw Tailwind color classes (`bg-green-500`, `bg-blue-500`) in `container` or `className` — use design tokens (`bg-success`, `bg-primary`) instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`) — override CSS variables in your `@theme` block.
- Don't use `Progress` for operations with unknown durations — use `Spinner` instead.
- Don't update `percent` more frequently than needed; excessive updates cause jitter.

## Accessibility

- Built on Base UI `Progress.Root` which renders the correct `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` automatically.
- The label overlay is a `<p>` element with `tabular-nums` for consistent digit rendering.

## Notes

- The indicator moves via a CSS `translateX` transform (`translateX(-${100 - percent}%)`) for GPU-accelerated animation.
- The 500 ms `transition-transform ease-in-out` is applied via the `className` on the indicator element and can be overridden.
- When `percent` is `undefined` or `null`, the label and fill are hidden; the track remains visible.
