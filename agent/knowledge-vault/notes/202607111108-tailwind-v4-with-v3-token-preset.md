---
title: "Tailwind v4 with a v3 token preset"
type: approach
scope: project
created: 2026-07-11
source: "Tailwind CSS v4 Vite migration"
---

# Tailwind v4 with a v3 token preset

## Trigger

When migrating this project to Tailwind CSS v4 while `@g4rcez/components` still exposes a Tailwind v3 JavaScript preset.

## Approach

1. Use `@tailwindcss/vite` in every renderer Vite config and load a dedicated CSS entry with `@import "tailwindcss"` plus `@config`.
2. Flatten the component preset into the project config because v4 does not resolve its preset color functions as utilities; convert only recursive color functions to their static token-variable values.
3. Add `@reference` to imported CSS files that use `@apply`, then validate both browser and Electron renderer builds and confirm representative component token classes exist in generated CSS.

## Why it worked

Tailwind v4 can load legacy JavaScript configuration, but the component package's v3 opacity callbacks are not registered as v4 color utilities. Resolving those callbacks without replacing their CSS-variable token values preserves semantic classes and theme behavior.

## Reuse checklist

- [ ] Configure every Vite renderer pipeline
- [ ] Preserve `@g4rcez/components` semantic token variables
- [ ] Reference the Tailwind entry from imported files using `@apply`
- [ ] Check browser and Electron renderer production builds
- [ ] Verify representative token utilities in generated CSS

## Links

- Related: [Tailwind CSS Vite installation](https://tailwindcss.com/docs/installation/using-vite)
