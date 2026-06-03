---
title: DatePicker
description: Date input with locale-aware masked entry and a floating calendar dropdown for visual selection.
package: "@g4rcez/components"
export: "{ DatePicker }"
import: "import { DatePicker } from '@g4rcez/components/date-picker'"
category: form
---

# DatePicker

Date input with locale-aware masked entry and a floating calendar dropdown for visual selection.

## Import

```tsx
import { DatePicker } from "@g4rcez/components/date-picker";
```

## Props

`DatePicker` inherits all `Input` and `Calendar` props. Notable additions:

| Prop           | Type                                | Default       | Description                                                                   |
| -------------- | ----------------------------------- | ------------- | ----------------------------------------------------------------------------- |
| `date`         | `Date`                              | -             | Controlled selected date                                                      |
| `type`         | `"date" \| "datetime"`              | `"date"`      | Whether to include time (hour + minute) selection                             |
| `floating`     | `boolean`                           | `true`        | Show the calendar in a floating `Dropdown`; set to `false` to embed it inline |
| `clickToClose` | `boolean`                           | `false`       | Close the calendar immediately after a date is picked                         |
| `locale`       | `Locales`                           | system locale | Locale for mask generation and calendar display                               |
| `markToday`    | `boolean`                           | `true`        | Highlight today in the calendar                                               |
| `disabledDate` | `(date: Date) => boolean`           | -             | Callback that returns `true` for dates that should be unselectable            |
| `onChange`     | `(date: Date \| undefined) => void` | -             | Called with the new `Date` when input is valid, or `undefined` when cleared   |
| `title`        | `string`                            | -             | Field label                                                                   |
| `error`        | `string`                            | -             | Error message shown below the field                                           |
| `required`     | `boolean`                           | `true`        | Marks field as required (default is `true` for DatePicker)                    |
| `name`         | `string`                            | -             | Form field name — also the `id` of the hidden `<input type="date">`           |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                    | CSS Variable            | Purpose                              |
| ------------------------ | ----------------------- | ------------------------------------ |
| `h-input-height`         | `--input-height`        | Input height                         |
| `px-input-padding-x`     | `--input-padding-x`     | Horizontal input padding             |
| `py-input-padding-y`     | `--input-padding-y`     | Vertical input padding               |
| `border-input-border`    | `--input-border`        | Default border color                 |
| `text-foreground`        | `--foreground`          | Input text color                     |
| `text-primary`           | `--primary`             | Focus ring and border on focus/hover |
| `text-danger`            | `--danger`              | Error state text and border          |
| `placeholder-input-mask` | `--input-mask`          | Placeholder text color               |
| `bg-floating-background` | `--floating-background` | Calendar dropdown background         |
| `border-floating-border` | `--floating-border`     | Calendar dropdown border             |

## Examples

### Basic date picker

```tsx
import { DatePicker } from "@g4rcez/components/date-picker";

<DatePicker name="birthdate" title="Date of birth" />;
```

### Date and time

```tsx
<DatePicker name="appointment" title="Appointment time" type="datetime" clickToClose />
```

### Disabling past dates

```tsx
import { isBefore, startOfDay } from "date-fns";

<DatePicker name="event_date" title="Event date" disabledDate={(date) => isBefore(date, startOfDay(new Date()))} />;
```

### Controlled value

```tsx
const [date, setDate] = useState<Date | undefined>();

<DatePicker name="due_date" title="Due date" date={date} onChange={setDate} />;
```

### Inline calendar (no dropdown)

```tsx
<DatePicker name="check_in" title="Check-in" floating={false} />
```

### Inside a form

```tsx
import { Form } from "@g4rcez/components/form";
import { Button } from "@g4rcez/components/button";

function BookingForm() {
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        const data = new FormData(e.currentTarget);
        console.log(data.get("check_in"), data.get("check_out"));
    };

    return (
        <Form onSubmit={handleSubmit} className="flex flex-col gap-base">
            <DatePicker name="check_in" title="Check-in" />
            <DatePicker name="check_out" title="Check-out" />
            <Button theme="primary" type="submit">
                Book
            </Button>
        </Form>
    );
}
```

## Do

- Use `disabledDate` to prevent invalid date selection (e.g., past dates for future bookings).
- Use `type="datetime"` when both date and time are required for the use case.
- Provide a clear `title` label.
- Rely on `locale` for locale-aware mask and calendar generation rather than hardcoding a format.

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`, `border-gray-300`) — use theme props or design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `bg-[--my-var]`) — override CSS variables in your `@theme` block instead.
- Don't use `DatePicker` when only a year or only a month is needed — a `Select` is more appropriate.
- Don't assume users will always use the calendar; the masked text input must also be keyboard-friendly.

## Accessibility

- The calendar icon button includes an `aria-describedby` referencing a visually-hidden `<span>` with a translatable label.
- The underlying `Input` component handles `aria-disabled`, `aria-readonly`, and `aria-busy`.
- The calendar (`Calendar` component) is fully keyboard-navigable.
- The input is masked to prevent invalid character entry, reducing validation friction.
- Follows the standard `fieldset > label` structure from `InputField`.

## Data Attributes

- `data-component="date-picker"` — on the visible `Input`.
- `data-value` — ISO string representation of the selected date (set on the visible input).
- `data-target` — mirrors the `name` prop; used to link the shadow input to the hidden field.
- `data-origin` — on the hidden `<input type="date">`: its `name` value, used by `formReset`.

## Notes

- The component renders two inputs: a visible masked `Input` for user interaction and a hidden `<input type="date">` (with `name`) for native form submission.
- The input mask is generated dynamically from `Intl.DateTimeFormat.formatToParts`, so it automatically reflects the locale's date order (e.g., MM/DD/YYYY vs DD/MM/YYYY).
- Date parsing uses `date-fns`. The `placeholder` is derived from the same locale format string.
- When `floating={true}` (default), the calendar is rendered in a `Dropdown` using `@floating-ui/react` positioned to the right of the input.
