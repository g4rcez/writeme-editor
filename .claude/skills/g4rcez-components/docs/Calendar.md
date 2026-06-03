---
title: Calendar
description: Interactive month-view calendar with single-date and range selection, keyboard navigation, and locale support.
package: "@g4rcez/components"
export: "{ Calendar }"
import: "import { Calendar } from '@g4rcez/components/calendar'"
category: display
---

# Calendar

Interactive month-view calendar with single-date and range selection, keyboard navigation, and locale support.

## Import

```tsx
import { Calendar } from "@g4rcez/components/calendar";
import type { Range, Locales } from "@g4rcez/components/calendar";
```

## Props

| Prop                | Type                            | Default  | Description                                                           |
| ------------------- | ------------------------------- | -------- | --------------------------------------------------------------------- |
| `date`              | `Date`                          | —        | Selected date (single-date mode)                                      |
| `range`             | `Range`                         | —        | Selected range `{ from?: Date; to?: Date }`                           |
| `rangeMode`         | `boolean`                       | `false`  | Enable range selection mode                                           |
| `markRange`         | `boolean`                       | `true`   | Visually highlight dates inside a range                               |
| `markToday`         | `boolean`                       | `true`   | Emphasize today's date                                                |
| `type`              | `"date" \| "datetime"`          | `"date"` | Show an additional time input when `"datetime"`                       |
| `datetimeTitle`     | `string`                        | —        | Label for the time input in `"datetime"` mode                         |
| `onChange`          | `OnChangeDate \| OnChangeRange` | —        | Called when a date or range changes                                   |
| `changeOnlyOnClick` | `boolean`                       | `false`  | Suppress onChange on keyboard navigation; fire only on explicit click |
| `onChangeYear`      | `(date: Date) => void`          | —        | Called when the year changes                                          |
| `onChangeMonth`     | `(date: Date) => void`          | —        | Called when the month changes                                         |
| `disabledDate`      | `(date: Date) => boolean`       | —        | Return `true` to disable a specific date                              |
| `RenderOnDay`       | `React.FC<{ date: Date }>`      | —        | Custom renderer overlaid on each day cell                             |
| `locale`            | `Locales`                       | —        | BCP 47 locale string for month/weekday labels                         |
| `labelRange`        | `{ from: string; to: string }`  | —        | Labels shown on the selected range endpoints                          |
| `styles`            | `CalendarStyles`                | —        | Fine-grained class overrides per calendar section                     |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                           | CSS Variable           | Purpose                                   |
| ------------------------------- | ---------------------- | ----------------------------------------- |
| `bg-primary`                    | `--primary`            | Selected day background                   |
| `text-primary-foreground`       | `--primary-foreground` | Selected day text                         |
| `hover:bg-primary`              | `--primary`            | Navigation button hover background        |
| `hover:text-primary-foreground` | `--primary-foreground` | Navigation button hover text              |
| `text-primary`                  | `--primary`            | "Today" button and year/month hover color |
| `text-disabled`                 | `--disabled`           | Days outside the current month            |
| `border-card-border`            | `--card-border`        | Range highlight border                    |
| `text-foreground`               | `--foreground`         | Range endpoint label                      |

## Examples

### Single Date Selection

```tsx
import { useState } from "react";

function DatePicker() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    return <Calendar date={selectedDate} onChange={setSelectedDate} markToday />;
}
```

### Date Range Selection

```tsx
import { useState } from "react";
import { Calendar, type Range } from "@g4rcez/components/calendar";

function DateRangePicker() {
    const [range, setRange] = useState<Range>({ from: undefined, to: undefined });

    return <Calendar range={range} rangeMode markRange onChange={setRange} labelRange={{ from: "Start Date", to: "End Date" }} />;
}
```

### Disabled Dates

```tsx
const isPastDate = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
};

<Calendar date={selectedDate} onChange={setSelectedDate} disabledDate={isPastDate} />;
```

### Booking Calendar with Range Restrictions

```tsx
function BookingCalendar() {
    const [bookingRange, setBookingRange] = useState<Range>({});

    const isDateDisabled = (date: Date): boolean => {
        const today = new Date();
        const minDate = new Date(today);
        minDate.setDate(today.getDate() + 2);
        const maxDate = new Date(today);
        maxDate.setDate(today.getDate() + 90);
        return date < minDate || date > maxDate;
    };

    return (
        <Calendar
            range={bookingRange}
            rangeMode
            markRange
            markToday
            onChange={setBookingRange}
            disabledDate={isDateDisabled}
            labelRange={{ from: "Check-in", to: "Check-out" }}
        />
    );
}
```

### Internationalized Calendar

```tsx
import { Calendar, type Locales } from "@g4rcez/components/calendar";

function InternationalCalendar() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [locale, setLocale] = useState<Locales>("en");

    return <Calendar date={selectedDate} onChange={setSelectedDate} locale={locale} markToday />;
}
```

### Custom Day Renderer

```tsx
function EventDot({ date }: { date: Date }) {
    const hasEvent = myEvents.some((e) => e.date.toDateString() === date.toDateString());
    return hasEvent ? <span className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary" /> : null;
}

<Calendar date={selectedDate} onChange={setSelectedDate} RenderOnDay={EventDot} markToday />;
```

## Do

- Use `markToday` to help users orient themselves.
- Use `disabledDate` to restrict selection to valid periods.
- Provide `labelRange` labels when using `rangeMode` so users know which endpoint they are selecting.
- Pass the correct `locale` to match user locale preferences.
- Use design-token classes for any wrapper elements (`bg-background`, `border-border`).

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`) in `styles` or `RenderOnDay` — use design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`) — override CSS variables in your `@theme` block.
- Don't use `Calendar` when only year selection is needed — a `Select` is more efficient.
- Don't place too many visual markers on each day; keep day-level indicators minimal.

## Accessibility

- Full keyboard navigation: Arrow keys move days, Shift+Arrow moves months/years, Enter/Space selects.
- Month and year controls are accessible `<select>` and masked text inputs with `aria-label`.
- Navigation buttons include `title` attributes for screen reader description.
- Disabled dates use the native `disabled` attribute on `<button>`.

## Data Attributes

- `data-component="calendar"` — root container.
- `data-date` — ISO date string on each day button, used for focus management.
- `data-samemonth` — `"true"` / `"false"` on each day button.
- `data-range` — `"true"` / `"false"` on each day button.
- `data-focustrap` — `"prev"` / `"next"` on navigation buttons.

## Notes

- Uses `date-fns` for date arithmetic and Framer Motion (`motion/react`) for slide animations.
- Touch devices get swipe-left/right support for month navigation automatically.
- When `changeOnlyOnClick` is `false` (default), `onChange` fires on every keyboard navigation move.
- The calendar always renders 6 weeks (42 cells) to avoid layout shifts when switching months.
- `type="datetime"` appends a masked time input below the calendar grid.
