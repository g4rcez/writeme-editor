---
name: g4rcez-components
description: >
    Use when: setting up @g4rcez/components in a new project, migrating native
    HTML elements or hand-rolled UI to this design system, building any React UI
    that should use @g4rcez/components, or when the user's project already has
    @g4rcez/components as a dependency. Covers installation, Tailwind v3 preset,
    Tailwind v4 CSS-first setup, theming with createTokenStyles/TokenRemap,
    ComponentsProvider/tweaks, parsers, the full component catalog (components,
    hooks, React, UI, design-system, tokens, Tailwind, forms, modals,
    notifications, tables, calendar, theming), and native-element migration.
---

Loaded automatically when this package is present. Read fully before writing or modifying UI.

# @g4rcez/components — Agent Skill

A React design system built on Tailwind CSS and design tokens. This skill covers
installation, Tailwind setup (v3 and v4), theming APIs, conventions, the full
component catalog, and migration from native HTML patterns.

---

## 1 — Installation

```bash
pnpm add @g4rcez/components
```

The package ships:

- `dist/` — compiled JS/TS and CSS
- `dist/index.css` — main stylesheet
- `ai/SKILL.md` — this file
- `ai/docs/` — per-component documentation (51 pages)

Access any file via the package specifier: `@g4rcez/components/ai/SKILL.md`, `@g4rcez/components/ai/docs/Button.md`, etc.

---

## 2 — Tailwind Setup

### v3 (preset-based)

Add the library preset to `tailwind.config.ts`. The preset registers all design tokens as Tailwind utilities.

```ts
import preset from "@g4rcez/components/preset.tailwind";

export default {
    presets: [preset],
    content: ["./src/**/*.{ts,tsx}", "./node_modules/@g4rcez/components/dist/**/*.js"],
};
```

### v4 (CSS-first)

Import Tailwind and the library stylesheet, then reference the library config via `@config`:

```css
@import "tailwindcss";
@import "@g4rcez/components/dist/index.css";
@config "./tailwind.config.ts";
```

The library's `tailwind.config.ts` uses `plugin.tailwind` (the v4-compatible plugin):

```ts
import plugin from "@g4rcez/components/plugin.tailwind";

export default {
    plugins: [plugin],
    content: ["./src/**/*.{ts,tsx}", "./node_modules/@g4rcez/components/dist/**/*.js"],
};
```

### Theme class (required for both versions)

Apply `light` or `dark` on your root element:

```tsx
<html className="light">...</html>
// or
<html className="dark">...</html>
```

### ComponentsProvider (optional, required for dark-mode toggle)

Wrap your app root to enable i18n strings, locale-aware masks, and `Modal.confirm`:

```tsx
import { ComponentsProvider } from "@g4rcez/components";

export default function App({ children }) {
    return <ComponentsProvider locale="en-US">{children}</ComponentsProvider>;
}
```

---

## 3 — Theme Setup with createTokenStyles

Use `createTokenStyles` to generate scoped CSS strings for light and dark themes, then inject them into `<head>` via a `<style>` element.

```ts
import { createTokenStyles, createCssProperties, type TokenRemap } from "@g4rcez/components";
```

- `createTokenStyles(theme, map?)` — returns a scoped CSS string, e.g. `html { --primary: … }`
- `createCssProperties(theme, map?)` — returns an inline style object with CSS custom properties
- When `map.name` is set (e.g. `"dark"`), the output scopes to `html.dark { … }`
- Use `createTokenStyles` for `<style>` injection; use `createCssProperties` for inline `style` props

### Two-theme pattern (light + dark)

```tsx
import { createTokenStyles, type TokenRemap, defaultLightTheme, defaultDarkTheme } from "@g4rcez/components";

const tokenRemap: TokenRemap = {
    colors: (t) => {
        // Strip hsla( wrapper so Tailwind opacity utilities (bg-primary/50) work
        t.value = t.value.replace("hsla(", "").replace(/\)$/, "");
        return t;
    },
};

const stylesLight = createTokenStyles(defaultLightTheme, tokenRemap);
const stylesDark = createTokenStyles(defaultDarkTheme, { ...tokenRemap, name: "dark" });

// Inject stylesLight and stylesDark as <style> elements in your layout <head>.
// Both are internally-generated CSS strings (design tokens only), not user input.
```

---

## 4 — TokenRemap

`TokenRemap` transforms each design token value before it is emitted as a CSS custom property.

```ts
export type TokenRemap = Partial<Record<"colors" | "spacing" | "rounded" | "customTokens" | "zIndex", (t: Token) => Token> & { name: string }>;
```

Stripping `hsla(…)` in the colors transformer is required for Tailwind opacity utilities (`bg-primary/50`) — they expect raw channel values (`210 40% 60%`), not a wrapped `hsla(210 40% 60%)`.

---

## 5 — ComponentsProvider & Tweaks

```tsx
import { ComponentsProvider, type Tweaks, parsers } from "@g4rcez/components";

const tweaks: Tweaks = {
    table: {
        sorters: true,
        filters: true,
        operations: true,
        sticky: 55,
    },
};

<ComponentsProvider locale="en-US" tweaks={tweaks} parser={parsers.hsla}>
    {children}
</ComponentsProvider>;
```

---

## 6 — Key Conventions

### Never use raw Tailwind color classes

```tsx
// Wrong
<div className="bg-blue-500 text-white">...</div>

// Right — use design-token classes
<div className="bg-primary text-primary-foreground">...</div>
```

### Always use component `theme` / `variant` props

```tsx
// Wrong
<button className="bg-red-600 text-white">Delete</button>

// Right
<Button theme="danger">Delete</Button>
```

---

## 7 — Component Catalog

The library supports both barrel imports and sub-path imports for tree-shaking:

- `Button` — `@g4rcez/components` or `@g4rcez/components/button`
- `Input` — `@g4rcez/components` or `@g4rcez/components/input`
- `Modal` — `@g4rcez/components` or `@g4rcez/components/modal`
- `Table` — `@g4rcez/components` or `@g4rcez/components/table`
- `Select` — `@g4rcez/components` or `@g4rcez/components/select`

See `@g4rcez/components/ai/docs/index.md` for the complete export list.

---

## 8 — Migration from Native HTML

- `<button>` → `Button`
- `<input type="text">` → `Input`
- `<input type="date">` → `DatePicker`
- `<input type="checkbox">` → `Checkbox`
- `<select>` → `Select`
- Custom modal / dialog → `Modal` (type `"dialog"`)
- Side panel / drawer → `Modal` (type `"drawer"`)
- Toast / notifications → `Notifications`
- Data table → `Table`

---

## 9 — Per-Component Documentation

Each component has a dedicated doc page with full props, design tokens, and usage examples:

`@g4rcez/components/ai/docs/<ComponentName>.md`

Examples:

- `@g4rcez/components/ai/docs/Button.md`
- `@g4rcez/components/ai/docs/Input.md`
- `@g4rcez/components/ai/docs/Modal.md`
- `@g4rcez/components/ai/docs/Table.md`
- `@g4rcez/components/ai/docs/Form.md`
