# Feature: Darken Mermaid item backgrounds

## Problem

Mermaid item backgrounds are still too light in dark themes. The chart should use darker item fills while preserving AAA contrast for item labels.

## Solution

- Use the semantic `primary.subtle` token for Mermaid item fills.
- Use `foreground` for labels on those darker item fills.
- Keep primary accents as borders so Mermaid items remain visibly connected to the theme.
- Update regression tests to lock the darker item-fill token mapping and concrete HSLA resolution.

## Definition of Done

- [x] Mermaid flowchart items use `primary-subtle` as the item background token.
- [x] Mermaid item text uses `foreground` for high contrast on the darker fill.
- [x] Tests verify both token mapping and concrete token resolution.
- [x] Targeted verification complete: `npm test -- src/app/elements/mermaid-theme.test.ts` passed (4 tests).
- [x] LSP diagnostics pass for changed Mermaid theme files.
- [x] Type checking attempted. `npm exec -- tsc --noEmit --ignoreDeprecations 6.0` reaches existing unrelated project errors outside the Mermaid changes.
