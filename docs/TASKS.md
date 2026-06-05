# Tasks

## getLinkTitleDomain helper

- [x] Inspect current domain-link display/config structure.
- [x] Refactor domain configs around a shared title function.
- [x] Implement and export `getLinkTitleDomain(url)`.
- [x] Add focused regression tests for known domains and fallback behavior.
- [x] Run targeted tests and diagnostics.
- [x] Document manual verification results.
- [x] Complete self-review and mark verification done.

## Restore full link hover dropdown

- [x] Locate link preview and labelled link rendering paths.
- [x] Add hover preview rendering for `LinkMark`.
- [x] Improve full URL display in link previews.
- [x] Add regression coverage for labelled link hover trigger attributes.
- [x] Run targeted tests and diagnostics.
- [x] Complete self-review and mark verification done.

## Remove outer app scroll while editing

- [x] Locate the app/editor scroll hierarchy.
- [x] Lock the document, body, and React root overflow.
- [x] Add `min-h-0`/overflow containment to the app shell and resizable editor panels.
- [x] Run diagnostics/type checks.
- [x] Document manual verification results.
- [x] Complete self-review and mark verification done.

## Darken Mermaid item backgrounds

- [x] Switch Mermaid item fills to the darker `primary-subtle` token.
- [x] Switch Mermaid item labels to `foreground` for contrast on darker fills.
- [x] Update Mermaid theme tests for token mapping and concrete resolution.
- [x] Run targeted tests and diagnostics.
- [x] Complete self-review and mark verification done.

## Fix Mermaid chart AAA contrast tokens

- [x] Locate Mermaid render/theme configuration and CSS overrides.
- [x] Replace hardcoded theme values with token-backed Mermaid theme variables.
- [x] Replace raw Mermaid CSS colors with token-backed CSS variables.
- [x] Add regression coverage for critical Mermaid token mappings.
- [x] Run targeted tests and diagnostics.
- [x] Complete self-review and mark verification done.

## Opened tabs commander shortcut

- [x] Confirm commander filtering, shortcut registration, and tab title lookup patterns.
- [x] Add an opened-tabs commander type.
- [x] Build opened-tab command items from sorted open tabs.
- [x] Register `Ctrl/Cmd+T` to open the opened-tabs commander.
- [x] Add/update regression tests for the shortcut list.
- [x] Run targeted tests and diagnostics.
- [x] Complete self-review and mark verification done.

## Task: Explore the existing Commander implementation and how it is opened/filtered

- [x] Locate Commander entry points and filtering.
- [x] Locate global tab state and tab UI patterns.
- [x] Locate shortcut registration and key normalization.
- [x] Write scouting findings to `context.md`.

## Ctrl+Tab editor tab cycling

- [x] Confirm tab state, routing, and existing keyboard shortcut entry point.
- [x] Add a small tab-cycle helper used by `RootLayout`.
- [x] Wire `Ctrl+Tab` forward and `Shift+Ctrl+Tab` backward.
- [x] Add regression tests for wraparound forward/backward tab cycling.
- [x] Run targeted tests and diagnostics.
- [x] Complete self-review and mark verification done.

## Filetree sidebar create actions

- [x] Locate Explorer header buttons and existing TreeView create flow.
- [x] Add a controlled create request path from Explorer to TreeView.
- [x] Wire header actions in order: file, folder.
- [x] Add regression coverage for root header-style create requests and empty trees.
- [x] Run targeted tests and diagnostics.
- [x] Complete self-review and mark verification done.

## Fix link paste over selected text

- [x] Locate URL paste/domain-link handling.
- [x] Add a normal text link mark for custom-labelled links.
- [x] Intercept URL paste on a non-empty selection and apply the link mark.
- [x] Add regression tests for selected-text URL paste and labelled markdown links.
- [x] Run targeted tests and type checks.
- [x] Complete self-review and mark verification done.

## Explore editor tab switching

- [x] Locate tab UI, state, persistence, and keyboard shortcut entry points.
- [x] Write scouting findings to `context.md`.
