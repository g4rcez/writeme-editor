---
title: "@g4rcez/components — Component Index"
description: Full component catalog for @g4rcez/components React design system
package: "@g4rcez/components"
---

# @g4rcez/components — Component Index

A design system library built on React, Tailwind CSS, and design tokens.

**Installation:**

```bash
npm install @g4rcez/components
```

**Setup:**

```tsx
import "@g4rcez/components/index.css";
```

## All Components

| Component      | Category | Import                                                             | Description                                                               |
| -------------- | -------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Button         | Core     | `import { Button } from "@g4rcez/components/button"`               | Versatile button with multiple variants, sizes, and polymorphic rendering |
| Tag            | Core     | `import { Tag } from "@g4rcez/components/tag"`                     | Label/badge for metadata, status, and categorization                      |
| Heading        | Core     | `import { Heading } from "@g4rcez/components"`                     | Semantic heading with consistent typography tokens                        |
| Polymorph      | Core     | `import { Polymorph } from "@g4rcez/components"`                   | Polymorphic base component for rendering as any HTML element              |
| RenderOnView   | Core     | `import { RenderOnView } from "@g4rcez/components"`                | Lazy-renders children when they scroll into the viewport                  |
| Resizable      | Core     | `import { Resizable } from "@g4rcez/components"`                   | Drag-to-resize panel container                                            |
| Slot           | Core     | `import { Slot } from "@g4rcez/components"`                        | Render-prop slot for component composition                                |
| Typography     | Core     | `import { Typography } from "@g4rcez/components"`                  | Body text component with semantic token styling                           |
| Alert          | Display  | `import { Alert } from "@g4rcez/components/alert"`                 | Dismissible alert for messages, warnings, and status updates              |
| AnimatedList   | Display  | `import { AnimatedList } from "@g4rcez/components"`                | List with enter/exit animation for dynamic items                          |
| Calendar       | Display  | `import { Calendar } from "@g4rcez/components/calendar"`           | Inline date picker calendar                                               |
| Card           | Display  | `import { Card } from "@g4rcez/components/card"`                   | Surface container with card tokens and elevation                          |
| Empty          | Display  | `import { Empty } from "@g4rcez/components"`                       | Empty state placeholder with optional icon and action                     |
| List           | Display  | `import { List } from "@g4rcez/components/list"`                   | Virtualized scrollable list for large data sets                           |
| Notifications  | Display  | `import { Notifications } from "@g4rcez/components/notifications"` | Toast notification system with queue management                           |
| Progress       | Display  | `import { Progress } from "@g4rcez/components"`                    | Progress bar with themed fill                                             |
| Shortcut       | Display  | `import { Shortcut } from "@g4rcez/components"`                    | Keyboard shortcut badge display                                           |
| Skeleton       | Display  | `import { Skeleton } from "@g4rcez/components"`                    | Loading placeholder with pulse animation                                  |
| Spinner        | Display  | `import { Spinner } from "@g4rcez/components"`                     | Animated loading spinner                                                  |
| Stats          | Display  | `import { Stats } from "@g4rcez/components/stats"`                 | Metric/statistics display with label and value                            |
| Step           | Display  | `import { Step } from "@g4rcez/components"`                        | Multi-step wizard progress indicator                                      |
| Tabs           | Display  | `import { Tabs } from "@g4rcez/components/tabs"`                   | Tabbed navigation with panel switching                                    |
| Timeline       | Display  | `import { Timeline } from "@g4rcez/components/timeline"`           | Vertical event timeline with themed markers                               |
| Autocomplete   | Form     | `import { Autocomplete } from "@g4rcez/components/autocomplete"`   | Text input with dropdown suggestions                                      |
| Checkbox       | Form     | `import { Checkbox } from "@g4rcez/components/checkbox"`           | Checkbox with indeterminate support                                       |
| DatePicker     | Form     | `import { DatePicker } from "@g4rcez/components/date-picker"`      | Date input with calendar popover                                          |
| FileUpload     | Form     | `import { FileUpload } from "@g4rcez/components/file-upload"`      | Drag-and-drop file upload with preview                                    |
| Form           | Form     | `import { Form } from "@g4rcez/components/form"`                   | Form wrapper with Zod validation and field management                     |
| FormReset      | Form     | `import { FormReset } from "@g4rcez/components"`                   | Reset button wired to the nearest Form context                            |
| Input          | Form     | `import { Input } from "@g4rcez/components/input"`                 | Text input with mask, prefix/suffix, and error states                     |
| InputField     | Form     | `import { InputField } from "@g4rcez/components"`                  | Input with label, helper text, and error message                          |
| MultiSelect    | Form     | `import { MultiSelect } from "@g4rcez/components"`                 | Multi-value select with search and tag display                            |
| Radiobox       | Form     | `import { Radiobox } from "@g4rcez/components/radiobox"`           | Styled radio button group                                                 |
| Select         | Form     | `import { Select } from "@g4rcez/components/select"`               | Dropdown select with search and virtual scroll                            |
| Slider         | Form     | `import { Slider } from "@g4rcez/components"`                      | Range slider input                                                        |
| Switch         | Form     | `import { Switch } from "@g4rcez/components/switch"`               | Toggle switch for boolean values                                          |
| TaskList       | Form     | `import { TaskList } from "@g4rcez/components/task-list"`          | Checklist with completion tracking                                        |
| Textarea       | Form     | `import { Textarea } from "@g4rcez/components"`                    | Multi-line text input with auto-resize                                    |
| CommandPalette | Floating | `import { CommandPalette } from "@g4rcez/components"`              | Spotlight-style command palette with keyboard navigation                  |
| Dropdown       | Floating | `import { Dropdown } from "@g4rcez/components/dropdown"`           | Floating dropdown menu anchored to a trigger                              |
| Expand         | Floating | `import { Expand } from "@g4rcez/components/expand"`               | Collapsible accordion/expand panel                                        |
| Menu           | Floating | `import { Menu } from "@g4rcez/components/menu"`                   | Context menu or navigation menu                                           |
| Modal          | Floating | `import { Modal } from "@g4rcez/components/modal"`                 | Dialog overlay with focus trap and scroll lock                            |
| Toolbar        | Floating | `import { Toolbar } from "@g4rcez/components"`                     | Grouped action bar with button slots                                      |
| Tooltip        | Floating | `import { Tooltip } from "@g4rcez/components/tooltip"`             | Hover tooltip with floating positioning                                   |
| Wizard         | Floating | `import { Wizard } from "@g4rcez/components"`                      | Multi-step guided flow overlay                                            |
| Table          | Table    | `import { Table } from "@g4rcez/components/table"`                 | Feature-rich data table with sorting, filtering, and virtualization       |
| PageCalendar   | Calendar | `import { PageCalendar } from "@g4rcez/components"`                | Full-page calendar with month, week, and day views                        |

---

## Core

| Component    | Import                                               | Description                                                               |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| Button       | `import { Button } from "@g4rcez/components/button"` | Versatile button with multiple variants, sizes, and polymorphic rendering |
| Tag          | `import { Tag } from "@g4rcez/components/tag"`       | Label/badge for metadata, status, and categorization                      |
| Heading      | `import { Heading } from "@g4rcez/components"`       | Semantic heading with consistent typography tokens                        |
| Polymorph    | `import { Polymorph } from "@g4rcez/components"`     | Polymorphic base component for rendering as any HTML element              |
| RenderOnView | `import { RenderOnView } from "@g4rcez/components"`  | Lazy-renders children when they scroll into the viewport                  |
| Resizable    | `import { Resizable } from "@g4rcez/components"`     | Drag-to-resize panel container                                            |
| Slot         | `import { Slot } from "@g4rcez/components"`          | Render-prop slot for component composition                                |
| Typography   | `import { Typography } from "@g4rcez/components"`    | Body text component with semantic token styling                           |

## Display

| Component     | Import                                                             | Description                                                  |
| ------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| Alert         | `import { Alert } from "@g4rcez/components/alert"`                 | Dismissible alert for messages, warnings, and status updates |
| AnimatedList  | `import { AnimatedList } from "@g4rcez/components"`                | List with enter/exit animation for dynamic items             |
| Calendar      | `import { Calendar } from "@g4rcez/components/calendar"`           | Inline date picker calendar                                  |
| Card          | `import { Card } from "@g4rcez/components/card"`                   | Surface container with card tokens and elevation             |
| Empty         | `import { Empty } from "@g4rcez/components"`                       | Empty state placeholder with optional icon and action        |
| List          | `import { List } from "@g4rcez/components/list"`                   | Virtualized scrollable list for large data sets              |
| Notifications | `import { Notifications } from "@g4rcez/components/notifications"` | Toast notification system with queue management              |
| Progress      | `import { Progress } from "@g4rcez/components"`                    | Progress bar with themed fill                                |
| Shortcut      | `import { Shortcut } from "@g4rcez/components"`                    | Keyboard shortcut badge display                              |
| Skeleton      | `import { Skeleton } from "@g4rcez/components"`                    | Loading placeholder with pulse animation                     |
| Spinner       | `import { Spinner } from "@g4rcez/components"`                     | Animated loading spinner                                     |
| Stats         | `import { Stats } from "@g4rcez/components/stats"`                 | Metric/statistics display with label and value               |
| Step          | `import { Step } from "@g4rcez/components"`                        | Multi-step wizard progress indicator                         |
| Tabs          | `import { Tabs } from "@g4rcez/components/tabs"`                   | Tabbed navigation with panel switching                       |
| Timeline      | `import { Timeline } from "@g4rcez/components/timeline"`           | Vertical event timeline with themed markers                  |

## Form

| Component    | Import                                                           | Description                                           |
| ------------ | ---------------------------------------------------------------- | ----------------------------------------------------- |
| Autocomplete | `import { Autocomplete } from "@g4rcez/components/autocomplete"` | Text input with dropdown suggestions                  |
| Checkbox     | `import { Checkbox } from "@g4rcez/components/checkbox"`         | Checkbox with indeterminate support                   |
| DatePicker   | `import { DatePicker } from "@g4rcez/components/date-picker"`    | Date input with calendar popover                      |
| FileUpload   | `import { FileUpload } from "@g4rcez/components/file-upload"`    | Drag-and-drop file upload with preview                |
| Form         | `import { Form } from "@g4rcez/components/form"`                 | Form wrapper with Zod validation and field management |
| FormReset    | `import { FormReset } from "@g4rcez/components"`                 | Reset button wired to the nearest Form context        |
| Input        | `import { Input } from "@g4rcez/components/input"`               | Text input with mask, prefix/suffix, and error states |
| InputField   | `import { InputField } from "@g4rcez/components"`                | Input with label, helper text, and error message      |
| MultiSelect  | `import { MultiSelect } from "@g4rcez/components"`               | Multi-value select with search and tag display        |
| Radiobox     | `import { Radiobox } from "@g4rcez/components/radiobox"`         | Styled radio button group                             |
| Select       | `import { Select } from "@g4rcez/components/select"`             | Dropdown select with search and virtual scroll        |
| Slider       | `import { Slider } from "@g4rcez/components"`                    | Range slider input                                    |
| Switch       | `import { Switch } from "@g4rcez/components/switch"`             | Toggle switch for boolean values                      |
| TaskList     | `import { TaskList } from "@g4rcez/components/task-list"`        | Checklist with completion tracking                    |
| Textarea     | `import { Textarea } from "@g4rcez/components"`                  | Multi-line text input with auto-resize                |

## Floating

| Component      | Import                                                   | Description                                              |
| -------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| CommandPalette | `import { CommandPalette } from "@g4rcez/components"`    | Spotlight-style command palette with keyboard navigation |
| Dropdown       | `import { Dropdown } from "@g4rcez/components/dropdown"` | Floating dropdown menu anchored to a trigger             |
| Expand         | `import { Expand } from "@g4rcez/components/expand"`     | Collapsible accordion/expand panel                       |
| Menu           | `import { Menu } from "@g4rcez/components/menu"`         | Context menu or navigation menu                          |
| Modal          | `import { Modal } from "@g4rcez/components/modal"`       | Dialog overlay with focus trap and scroll lock           |
| Toolbar        | `import { Toolbar } from "@g4rcez/components"`           | Grouped action bar with button slots                     |
| Tooltip        | `import { Tooltip } from "@g4rcez/components/tooltip"`   | Hover tooltip with floating positioning                  |
| Wizard         | `import { Wizard } from "@g4rcez/components"`            | Multi-step guided flow overlay                           |

## Table

| Component | Import                                             | Description                                                         |
| --------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| Table     | `import { Table } from "@g4rcez/components/table"` | Feature-rich data table with sorting, filtering, and virtualization |

## Calendar

| Component    | Import                                              | Description                                        |
| ------------ | --------------------------------------------------- | -------------------------------------------------- |
| PageCalendar | `import { PageCalendar } from "@g4rcez/components"` | Full-page calendar with month, week, and day views |

---

## Design Token Quick Reference

All components use CSS custom properties for theming. Override in your `@theme` block:

```css
@theme {
    --primary: oklch(0.6 0.2 250); /* primary color */
    --danger: oklch(0.6 0.2 30); /* danger/error color */
    --button-primary-bg: var(--primary);
    --button-primary-text: var(--primary-foreground);
}
```

See individual component docs for the full token list per component.

---

## Setup

```tsx
// 1. Import the stylesheet in your app root
import "@g4rcez/components/index.css";

// 2. Apply theme class on your root element
<div className="light"> ... </div>; // or "dark"
```
