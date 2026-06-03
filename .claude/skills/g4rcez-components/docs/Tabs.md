---
title: Tabs
description: Keyboard-accessible tab container for organizing content into switchable panels.
package: "@g4rcez/components"
export: "{ Tabs }"
import: "import { Tabs, Tab } from '@g4rcez/components/tabs'"
category: display
---

# Tabs

Keyboard-accessible tab container for organizing content into switchable panels.

## Import

```tsx
import { Tabs, Tab } from "@g4rcez/components/tabs";
```

## Props

### Tabs (Container)

| Prop        | Type                   | Default | Description                                         |
| ----------- | ---------------------- | ------- | --------------------------------------------------- |
| `active`    | `string`               | —       | ID of the currently active tab                      |
| `onChange`  | `(id: string) => void` | —       | Called when the active tab changes                  |
| `container` | `string`               | —       | Additional classes for the outer card container     |
| `className` | `string`               | —       | Additional classes for the card body (content area) |
| `children`  | `Tab[]`                | —       | `Tab` panel components                              |

### Tab (Panel)

| Prop       | Type              | Default | Description                                                     |
| ---------- | ----------------- | ------- | --------------------------------------------------------------- |
| `id`       | `string`          | —       | Unique identifier; matched against `Tabs.active`                |
| `title`    | `string`          | —       | Tab button label (use when label is a plain string)             |
| `label`    | `string`          | —       | Accessible label when `title` is a non-string React element     |
| `disabled` | `boolean`         | `false` | Disables the tab button and skips it during keyboard navigation |
| `children` | `React.ReactNode` | —       | Panel content rendered when this tab is active                  |

## Design Tokens

Tokens this component reads. Customize by overriding these CSS variables in your theme.

| Token                | CSS Variable        | Purpose                             |
| -------------------- | ------------------- | ----------------------------------- |
| `bg-card-background` | `--card-background` | Tab panel surface                   |
| `border-card-border` | `--card-border`     | Tab bar bottom line and card border |
| `border-primary`     | `--primary`         | Active tab bottom indicator         |
| `text-primary`       | `--primary`         | Active tab text color               |
| `text-disabled`      | `--disabled`        | Disabled tab text                   |

## Examples

### Basic Tabs

```tsx
const [active, setActive] = useState("overview");

<Tabs active={active} onChange={setActive}>
    <Tab id="overview" title="Overview">
        <h3>Project Overview</h3>
        <p>This is the overview of your project.</p>
    </Tab>

    <Tab id="details" title="Details">
        <h3>Project Details</h3>
        <p>Detailed information about your project.</p>
    </Tab>

    <Tab id="settings" title="Settings">
        <h3>Project Settings</h3>
        <p>Configure your project settings here.</p>
    </Tab>
</Tabs>;
```

### Tabs with Disabled State

```tsx
<Tabs active={activeTab} onChange={setActiveTab}>
    <Tab id="available" title="Available">
        <p>This tab is available.</p>
    </Tab>

    <Tab id="locked" title="Locked" disabled>
        <p>This content is not accessible yet.</p>
    </Tab>

    <Tab id="also-available" title="Also Available">
        <p>This tab is also available.</p>
    </Tab>
</Tabs>
```

### Settings Panel

```tsx
<Tabs active={activeTab} onChange={setActiveTab}>
    <Tab id="general" title="General">
        <GeneralSettings />
    </Tab>
    <Tab id="privacy" title="Privacy">
        <PrivacySettings />
    </Tab>
    <Tab id="notifications" title="Notifications">
        <NotificationSettings />
    </Tab>
</Tabs>
```

### Dynamic Tabs

```tsx
function DynamicTabs() {
    const [tabs, setTabs] = useState([
        { id: "tab1", title: "Tab 1", content: "Content 1" },
        { id: "tab2", title: "Tab 2", content: "Content 2" },
    ]);
    const [activeTab, setActiveTab] = useState("tab1");

    const addTab = () => {
        const newId = `tab${tabs.length + 1}`;
        setTabs([...tabs, { id: newId, title: `Tab ${tabs.length + 1}`, content: `Content ${tabs.length + 1}` }]);
        setActiveTab(newId);
    };

    return (
        <div className="space-y-4">
            <button onClick={addTab} className="px-3 py-1 bg-primary text-primary-foreground rounded-button-radius">
                Add Tab
            </button>

            <Tabs active={activeTab} onChange={setActiveTab}>
                {tabs.map((tab) => (
                    <Tab key={tab.id} id={tab.id} title={tab.title}>
                        <p>{tab.content}</p>
                    </Tab>
                ))}
            </Tabs>
        </div>
    );
}
```

### Form Wizard with Disabled Steps

```tsx
<Tabs active={currentStep} onChange={setCurrentStep}>
    <Tab id="step1" title="Personal Info">
        <PersonalInfoForm />
    </Tab>
    <Tab id="step2" title="Address" disabled={!step1Complete}>
        <AddressForm />
    </Tab>
    <Tab id="step3" title="Payment" disabled={!step2Complete}>
        <PaymentForm />
    </Tab>
</Tabs>
```

## Do

- Always set a default `active` tab to prevent an empty initial state.
- Use clear, concise tab titles (one to three words).
- Arrange tabs in a logical order matching the user's workflow.
- Use `disabled` for tabs not yet accessible (e.g. incomplete wizard steps).
- Use design-token classes for any custom styling (`bg-background`, `border-border`).

## Don't

- Don't pass raw Tailwind color classes (`bg-blue-50`, `border-gray-300`) — use design tokens instead.
- Don't use arbitrary Tailwind values (`bg-[#abc]`, `bg-[--my-var]`) — override CSS variables in your `@theme` block.
- Don't use more than 6–8 tabs; prefer sidebar navigation for larger sets.
- Don't use tabs for content that needs to be compared side-by-side.
- Don't use tabs for primary page-level navigation; use a nav bar instead.

## Accessibility

- Tab buttons use `aria-current="page"` and `aria-disabled` for screen reader state.
- Keyboard navigation: `ArrowLeft` / `ArrowRight` moves between tabs; `Tab` key focuses the header row.
- Disabled tabs are skipped during arrow-key navigation.
- Tab panels are only rendered when active (unmounted otherwise) — use this for performance but be aware that form state inside inactive panels is lost.

## Notes

- Only the active panel's `children` are rendered — inactive panels are unmounted.
- The tab header list is horizontally scrollable on small screens (`overflow-x-auto`).
- `Tabs` is built on top of `Card`, so it inherits card design tokens and the `container` / `className` props map to the card's `container` and `className` respectively.
- If `active` does not match any `Tab` `id`, the component selects the first available non-disabled tab automatically.
