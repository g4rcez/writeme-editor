---
title: PageCalendar
description: Full-page calendar with month, week, and day views, event filtering, and custom event rendering.
package: "@g4rcez/components"
export: "{ PageCalendar }"
import: "import { PageCalendar } from '@g4rcez/components'"
category: calendar
---

# PageCalendar

Full-page calendar with month, week, and day views, event filtering, and custom event rendering.

## Import

```tsx
import { PageCalendar } from "@g4rcez/components";
```

## Props

| Prop              | Type                                     | Default      | Description                                                                           |
| ----------------- | ---------------------------------------- | ------------ | ------------------------------------------------------------------------------------- |
| `events`          | `CalendarEvent<T>[]`                     | —            | Array of event objects to display across all views.                                   |
| `filters`         | `CalendarFilter[]`                       | `[]`         | Filter tag definitions. Each filter can be toggled to hide/show matching events.      |
| `defaultView`     | `"month" \| "week" \| "day"`             | `"month"`    | Initial view rendered when the component mounts.                                      |
| `defaultDate`     | `Date`                                   | `new Date()` | Initial date the calendar focuses on.                                                 |
| `onEventClick`    | `(event: CalendarEvent) => void`         | —            | Called when the user clicks an event pill.                                            |
| `onSlotClick`     | `(date: Date) => void`                   | —            | Called when the user clicks an empty time slot (week and day views).                  |
| `onAddEvent`      | `() => void`                             | —            | Called when the "Add event" button in the header is clicked. Omit to hide the button. |
| `onChangeFilters` | `(filters: CalendarFilter[]) => void`    | —            | Called whenever a filter is toggled, receiving the updated filter array.              |
| `renderEvent`     | `(event: CalendarEvent<T>) => ReactNode` | —            | Custom renderer for the selected event detail panel in day view.                      |
| `filterArea`      | `ReactNode`                              | —            | Replaces the default filter tag row in the header with custom content.                |
| `getFilterId`     | `() => void`                             | —            | Custom accessor to extract a `filterId` from an event. Defaults to `event.filterId`.  |

## Type Definitions

### CalendarEventBase

```ts
type CalendarEventBase = {
    id: string;
    date: Date;
};
```

### CalendarEvent

```ts
type CalendarEvent<T extends CalendarEventBase = CalendarEventBase> = T & {
    title: string;
    filterId?: string;
    className?: string;
};
```

`className` is applied directly to the event pill element in all views.

### CalendarFilter

```ts
type CalendarFilter = {
    id: string;
    label: string;
    enabled: boolean;
    theme: TagProps["theme"]; // "primary" | "success" | "warn" | "danger" | "info" | "neutral" | "secondary" | "muted"
};
```

### ViewMode

```ts
type ViewMode = "month" | "week" | "day";
```

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                     | CSS Variable           | Purpose                                            |
| ------------------------- | ---------------------- | -------------------------------------------------- |
| `bg-primary`              | `--primary`            | Today indicator background, selected day highlight |
| `text-primary-foreground` | `--primary-foreground` | Text on today / selected day indicator             |
| `bg-card`                 | `--card`               | Non-today day indicator background in header       |
| `text-foreground`         | `--foreground`         | Default text in day cells and header               |
| `text-muted-foreground`   | `--muted-foreground`   | Week label, hour labels, secondary text            |
| `border-border`           | `--border`             | Grid cell borders, day view hour-slot dividers     |
| `border-card-border`      | `--card-border`        | Day and week view column borders                   |
| `bg-muted`                | `--muted`              | Hover background on time slots                     |
| `z-calendar`              | `--z-calendar`         | `z-index` for the column resizer handle (value: 2) |
| `z-floating`              | `--z-floating`         | `z-index` for floating overlays (value: 22)        |

## Views

### Month view

Displays a 6-row grid of all days in the selected month. Each day cell shows event pills. Clicking a day navigates to that day in the day view.

### Week view

Displays the 7 days of the current week with an hourly time grid. Events are placed at their time position. Clicking an empty slot calls `onSlotClick`.

### Day view

Displays a single day with an hourly grid alongside a mini calendar and a detail panel. The detail panel shows a default summary or your `renderEvent` output when an event is clicked.

## Examples

### Minimal calendar

```tsx
import { PageCalendar } from "@g4rcez/components";

type MyEvent = { id: string; date: Date; title: string };

const events: MyEvent[] = [{ id: "1", date: new Date(), title: "Team standup" }];

export function MyCalendar() {
    return <PageCalendar events={events} onEventClick={(event) => console.log(event)} />;
}
```

### With filters

```tsx
import { PageCalendar } from "@g4rcez/components";
import type { CalendarFilter } from "@g4rcez/components";

const filters: CalendarFilter[] = [
    { id: "work", label: "Work", enabled: true, theme: "primary" },
    { id: "personal", label: "Personal", enabled: true, theme: "success" },
];

const events = [
    { id: "1", date: new Date(), title: "Sprint planning", filterId: "work" },
    { id: "2", date: new Date(), title: "Gym", filterId: "personal" },
];

export function FilteredCalendar() {
    return <PageCalendar events={events} filters={filters} onChangeFilters={(updated) => console.log(updated)} />;
}
```

### Custom event detail in day view

```tsx
import { PageCalendar } from "@g4rcez/components";
import { MapPinIcon } from "@phosphor-icons/react";

export function DetailCalendar() {
    return (
        <PageCalendar
            events={events}
            defaultView="day"
            renderEvent={(event) => (
                <div className="flex flex-col gap-1 p-2 bg-muted rounded-card-radius">
                    <span className="font-semibold text-foreground">{event.title}</span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPinIcon size={12} />
                        {event.location}
                    </span>
                </div>
            )}
        />
    );
}
```

### Controlled add-event flow

```tsx
import { useState } from "react";
import { PageCalendar } from "@g4rcez/components";

export function EditableCalendar() {
    const [showForm, setShowForm] = useState(false);
    const [slotDate, setSlotDate] = useState<Date | null>(null);

    return (
        <>
            <PageCalendar
                events={events}
                onAddEvent={() => setShowForm(true)}
                onSlotClick={(date) => {
                    setSlotDate(date);
                    setShowForm(true);
                }}
            />
            {showForm && <EventForm defaultDate={slotDate} onClose={() => setShowForm(false)} />}
        </>
    );
}
```

### Custom filter area

```tsx
import { PageCalendar } from "@g4rcez/components";
import { Button } from "@g4rcez/components/button";

export function CustomFilterCalendar() {
    return (
        <PageCalendar
            events={events}
            filterArea={
                <div className="flex items-center gap-2 rounded-card-radius bg-muted px-3 py-1.5">
                    <Button theme="ghost-muted" size="small">
                        All
                    </Button>
                    <Button theme="primary" size="small">
                        Mine
                    </Button>
                </div>
            }
        />
    );
}
```

## Do

- Provide unique `id` values for every event and filter to ensure stable React keys and filter matching.
- Use `theme` on filters to give users a quick visual legend for event categories.
- Implement both `onAddEvent` and `onSlotClick` to give users two natural entry points for creating events.
- Use design-token classes in `renderEvent` output (`bg-muted`, `text-foreground`, `border-border`).
- Keep event `title` values short — they are truncated in month and week event pills.

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-500`, `text-white`, `border-gray-300`) — use `theme` on filters/events or design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `bg-[--my-var]`) — override CSS variables in your `@theme` block instead.
- Don't pack more than a handful of events per day in month view — the grid will overflow; guide users toward week or day view for dense schedules.
- Don't use extremely long event titles; they are truncated inside the event pill.
- Don't supply both `filterArea` and `filters` expecting both to render — `filterArea` fully replaces the default filter tag row.

## Accessibility

- The root container has `role="application"` and `aria-label` from the i18n translation key `pageCalendarLabel`.
- The header month/year title uses `aria-live="polite"` and `aria-atomic="true"` so screen readers announce date changes after navigation.
- Navigation buttons (`Previous`, `Today`, `Next`) have `aria-label` attributes for screen reader descriptions.
- View toggle buttons use `aria-pressed` to communicate the active view.
- Filter tags are rendered as `<button>` elements with `aria-pressed` and an `aria-label` that includes the enabled/disabled state.
- Day view hour slots have `role="button"`, `tabIndex={0}`, and `aria-label` for keyboard-accessible slot selection.
- The day column header uses `aria-label` with the full formatted date string.

## Data Attributes

- `data-component="day-view-scroller"` — the scrolling container inside the day view. Useful for CSS height overrides:

```css
[data-component="day-view-scroller"] {
    height: calc(100dvh - 200px);
}
```

## Notes

- Internally uses `date-fns` for all date arithmetic and locale-aware formatting. The locale is read from the `useLocale` hook; set it at the app root via the component provider.
- All labels (button text, ARIA strings, week number format) are driven by the i18n translation system. Override via the `translations` prop on the root provider.
- Event filtering is managed internally; `onChangeFilters` lets you mirror the filter state to an external store without controlling it.
- The day view mini-calendar renders dots beneath days that have events, matching the `bg-primary` token for visual consistency.
- The component grows to fill its container (`h-full flex-grow`). Place it inside a flex or grid container with an explicit height.
