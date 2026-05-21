# [LESSONS.md](http://LESSONS.md)

Hard-won lessons from bugs in this codebase. Each entry has a rule, the root cause, and a concrete example.

---

## React Hook Ordering: `useEffect` Must Come After the Values It References

**Rule:** Place every `useEffect` _after_ all `useMemo`, `useCallback`, and `const` declarations that the effect's body or dependency array references.

**Why this matters:** React hooks must be called in the same order on every render, but the _temporal dead zone_ (TDZ) still applies to `const`/`let` bindings — a `useEffect` callback defined before a `useMemo` can close over a reference that is not yet initialized when the module scope is evaluated, causing:

```
ReferenceError: Cannot access 'flattenedNodes' before initialization
```

**Concrete example** (`src/app/components/tree-view.tsx`):

```tsx
// BAD — useEffect referencing flattenedNodes appears before its useMemo
useEffect(() => {
  return window.electronAPI.onContextMenuAction(({ action, filePath }) => {
    const flatNode = flattenedNodes.find((n) => n.node.path === filePath);
    // ...
  });
}, [flattenedNodes]);

const flattenedNodes = useMemo(() => {
  // ← declared AFTER the effect above
  return flattenVisibleNodes(
    rootChildren,
    expandedPaths,
    childrenCache,
    searchQuery,
  );
}, [rootChildren, expandedPaths, childrenCache, searchQuery]);

// GOOD — declare useMemo first, then the effects that use it
const flattenedNodes = useMemo(() => {
  return flattenVisibleNodes(
    rootChildren,
    expandedPaths,
    childrenCache,
    searchQuery,
  );
}, [rootChildren, expandedPaths, childrenCache, searchQuery]);

useEffect(() => {
  return window.electronAPI.onContextMenuAction(({ action, filePath }) => {
    const flatNode = flattenedNodes.find((n) => n.node.path === filePath);
    // ...
  });
}, [flattenedNodes]);
```

**Checklist when writing or reviewing a component:**

- All `useMemo` / `useCallback` / derived `const` values appear before any `useEffect` that names them.
- If you move a hook, scan both old and new positions for forward references.

---

## Design Tokens: Never Use Raw Tailwind Colors — Always Use Design System Tokens

**Rule:** Never apply raw Tailwind palette classes (`bg-violet-600`, `bg-zinc-700`, `text-white`, etc.) when styling UI elements. Always use the semantic tokens exposed by `@g4rcez/components` through the Tailwind preset.

**Why this matters:** The app ships multiple themes (dark, light, catppuccin-mocha, tokyonight-night). Raw Tailwind colors are hardcoded and break on every theme that wasn't manually tested. Semantic tokens resolve to the correct value automatically in every theme.

**Token reference** — the preset maps the design token tree to Tailwind utilities:

| Token path             | Tailwind class example     | Dark value (reference)                         |
| ---------------------- | -------------------------- | ---------------------------------------------- |
| `primary.DEFAULT`      | `bg-primary`               | `hsla(201,49%,54%)`                            |
| `primary.foreground`   | `text-primary-foreground`  | `hsla(240,6%,10%)` ← **near-black, not white** |
| `button.primary.bg`    | `bg-button-primary-bg`     | `hsla(201,49%,42%)`                            |
| `button.primary.text`  | `text-button-primary-text` | `hsla(221,52%,100%)` ← white                   |
| `secondary.background` | `bg-secondary-background`  | `hsla(240,4%,16%)` — elevated surface          |
| `floating.background`  | `bg-floating-background`   | `hsla(240,10%,8%)` ≡ `bg-background` in dark   |
| `card.border`          | `border-card-border`       | `hsla(240,4%,11%)`                             |
| `foreground`           | `text-foreground`          | `hsla(240,5%,96%)` — near-white in dark        |
| `muted.DEFAULT`        | `bg-muted`                 | `hsla(240,4%,16%)`                             |
| `muted.foreground`     | `text-muted-foreground`    | `hsla(240,5%,65%)`                             |

**Critical traps in the dark theme:**

1. **`bg-floating-background` equals `bg-background` in dark** — both resolve to `hsla(240,10%,8%)`. Using `bg-floating-background` for a bubble on a panel with `bg-background` makes the element invisible. Use `bg-secondary-background` instead.
2. **`text-primary-foreground` is near-black in dark** — `hsla(240,6%,10%)`. Do NOT use it for text on a coloured bubble expecting white. Use `text-button-primary-text` which is white in every theme.
3. **`bg-primary` + `text-primary-foreground` is NOT a high-contrast pair in dark** — the background is medium blue and the text is near-black, producing poor perceptual contrast even though both tokens exist.

**Correct pattern for chat-style bubbles:**

```tsx
// ✅ GOOD — uses design system tokens, high contrast in all themes
// Sent / user bubble
<div className="bg-button-primary-bg text-button-primary-text">
  {/* white text on primary-blue button color, same as <Button theme="primary"> */}
</div>

// Received / assistant bubble
<div className="bg-secondary-background border border-card-border text-foreground">
  {/* elevated surface clearly distinct from bg-background in every theme */}
</div>

// ❌ BAD — raw Tailwind colors, breaks non-default themes
<div className="bg-violet-600 text-white">...</div>
<div className="bg-zinc-700 text-zinc-100">...</div>

// ❌ BAD — token mismatch: primary-foreground is near-black in dark
<div className="bg-primary text-primary-foreground">...</div>

// ❌ BAD — floating-background == background in dark; bubble disappears
<div className="bg-floating-background">...</div>
```

**Checklist before styling any surface:**

- Look up the token in `node_modules/@g4rcez/components/dist/styles/dark.js` and `light.js` to verify the actual HSL value.
- Confirm the foreground/background pair has sufficient contrast in BOTH light and dark themes before committing.
- When in doubt, use the `button.*` token subtree — it is the only part of the design system that is explicitly tested for foreground/background contrast.
