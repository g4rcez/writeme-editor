# Feature: Fix Mermaid chart AAA contrast tokens

## Problem

Mermaid flowchart nodes currently render light text on light purple node fills in dark mode, which fails AAA contrast and makes diagram labels hard to read. Some Mermaid CSS overrides also use raw HSL values instead of design-system tokens.

## Solution

- Resolve Mermaid diagram colors from semantic design-token CSS variables into concrete HSLA values before Mermaid initializes.
- Use the tested button primary token pair for Mermaid node fills and node text because it has high contrast across app themes.
- Use foreground/background/card/border tokens for diagram text, canvas, labels, clusters, and edges.
- Remove raw HSL Mermaid CSS overrides and use token-backed colors instead.
- Preserve Mermaid rendering while using `textContent` to seed chart source safely before Mermaid processes it.

## Edge Cases

- Dark, light, Catppuccin Mocha, and Tokyo Night should resolve colors from the active theme CSS variables.
- Flowchart node text must use the matching foreground token for the node fill.
- Edge labels and clusters should remain readable on the editor background.
- Existing Mermaid rendering and theme-change re-rendering should keep working.

## Task Breakdown

- [x] Locate Mermaid render/theme configuration and CSS overrides.
- [x] Replace hardcoded theme values with token-backed Mermaid theme variables.
- [x] Replace raw Mermaid CSS colors with token-backed CSS variables.
- [x] Add regression coverage for critical Mermaid token mappings.
- [x] Run targeted tests and diagnostics.
- [x] Perform self-review for accessibility, scope, and LESSONS.md compliance.

## Definition of Done

- [x] Mermaid flowchart node labels use a high-contrast token pair.
- [x] Mermaid diagram edges, labels, and clusters use semantic tokens instead of raw HSL palette values.
- [x] The fix resolves active theme CSS variables rather than only the default dark/light themes.
- [x] Targeted verification complete: `npm test -- src/app/elements/mermaid-theme.test.ts` passed (4 tests).
- [x] LSP diagnostics pass for changed Mermaid source/test files; CSS LSP was unavailable, so CSS validity was covered by the test and edit tool CSS check.
- [x] Type checking attempted. `npm exec -- tsc --noEmit --ignoreDeprecations 6.0` reaches existing unrelated project errors outside the Mermaid changes.
