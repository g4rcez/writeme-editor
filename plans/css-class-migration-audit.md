# CSS class ownership and component reuse audit

Reference commit: `da9f590`. This inventories the current working tree, including uncommitted changes. No application source was changed for this audit.

## Coverage

- Scanned **672 code/template files** and **11 project CSS files**.
- Found **156 files with class-related assignments** and **2025 captured assignments**.
- Found **12 additional files** with class references or DOM class operations.
- Excluded dependencies, generated output, and agent tooling.
- The installed TypeScript package provides version metadata but no JavaScript parser API. Counts come from a conservative text scan; structural body reads verified priority candidates.
- Counts cover className, class and styling props, including some object properties. Nested expressions, variables, forwarded classes and generated HTML need manual review.
- A literal CSS match is not proof of runtime use or valid Tailwind styling. Missing literal references are not proof of dead CSS.
- The standalone Tailwind compiler probe could not resolve Excalidraw's conditional CSS export. It is not evidence of an application build failure; use the project's Vite pipeline for verification.
- No new production build or browser test was run for this audit.

## Main finding

Several hotspots already have components. Move their styling into those existing owners instead of adding wrapper components.

Repeated Tailwind utilities already share emitted CSS. Extracting components can reduce repeated markup and improve consistency, but does not by itself reduce CSS bytes. The preceding editor-group migration saved 2,487 raw CSS bytes and 150 gzip bytes. Total JS-plus-CSS savings were not measured.

## Prioritized changes

Editor paths below are relative to `packages/editor/src/`.

| Priority    | Evidence                                                                                                              | Change                                                                                                          | Benefit and boundary                                                                                                                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1           | `app/components/sidebar/activity-bar.tsx:28–53`: ActivityIcon owns tooltip, label, pressed state, indicator and badge | Move activity-bar rules into ActivityIcon and ActivityBar                                                       | Remove custom UI rules. Preserve badge truncation, focus, tooltip behavior, contrast and native hooks. No second icon wrapper needed.                                                                            |
| 1           | `app/components/context-pane.tsx:50–74`: ContextSection owns details/summary                                          | Migrate section/header/body rules in their existing owners                                                      | Remove pane-specific rules. Preserve details keyboard behavior, drawer positioning, viewport constraints and outline navigation.                                                                                 |
| 1           | `app/components/sidebar/sidebar-shell.tsx:31–46`: SidebarNavItem already uses Button and utilities                    | Reuse it when semantics match; migrate remaining shell rules                                                    | Keep navigation aria-current separate from activity-button aria-pressed. Do not create another navigation system.                                                                                                |
| 2           | `app/pages/groups-list.page.tsx:38–46`, `app/pages/views-list.page.tsx:53–61`, tag and group-detail pages             | Review a shared collection-page frame/header with title, icon and action slots                                  | Consistent layout and less repeated JSX, not guaranteed CSS savings. Keep data/hooks in routes and preserve heading levels and layout.                                                                           |
| 2           | `app/pages/folder-workspace.page.tsx:95–101`, `app/pages/notes-list.page.tsx:140–160`                                 | Review one presentational EmptyState                                                                            | Share icon/heading/description/action structure. Keep search-empty and workspace-empty wording and callbacks in callers.                                                                                         |
| 2           | `app/pages/settings/settings-page-shell.tsx:10–27`, settings routes                                                   | Reuse SettingsPageShell; migrate settings-card overrides through supported Card styling props or a scoped owner | Remove settings CSS without adding a parallel shell. Preserve control focus and section semantics.                                                                                                               |
| 3           | `app/pages/settings/settings-templates.page.tsx:163–260`, `app/components/sidebar/templates-pane.tsx`                 | Review TemplateRow and variable-chip reuse                                                                      | Presentation reuse only after checking data shapes and semantics. Do not merge editor/dialog lifecycle, deletion or script/template execution flows.                                                             |
| Investigate | Image/PDF/video NodeViewWrapper framing                                                                               | Review a small media-frame responsibility                                                                       | Presentation only. Do not change NodeView ownership, selection, resize/drop behavior or serialized HTML classes.                                                                                                 |
| Investigate | `index.css:3–28`, `index.css:35`, `tailwind.config.ts`, `vite.config.ts`                                              | Audit global feature CSS imports and automatic Tailwind source detection                                        | Potential initial/unused CSS reduction, not measured. Vite has no explicit root and the Tailwind import has no source restriction. Verify actual candidates and library requirements before restricting sources. |

Confidence is high for the existing component owners and repeated page structure. Template/media extraction and source-scan savings remain investigation candidates.

## Component rules

1. Prefer existing @g4rcez/components Button, Input, Card and Modal primitives.
2. Extract a component for repeated structure, semantics, state presentation or accessibility—not only a short utility string.
3. Keep complete literal class strings in variant mappings; do not concatenate utility names.
4. Validate tokens against each application's configuration. Editor and landing vocabularies differ.
5. Avoid generic Box/Flex wrappers and a second styling framework.
6. Do not nest a button component inside a Dropdown trigger that already renders a button. Use its supported buttonProps surface.
7. Preserve unstyled hooks required by native overrides, tests, DOM integrations or exported documents. Deleting a marker alone saves no emitted CSS.
8. Moving unlayered CSS into utility layers changes cascade priority. Check computed styles before deleting the original rule.
9. Keep editor and landing implementations separate unless responsibilities and dependencies actually match.

## Keep or review separately

- Editor-generated paragraphs, nested lists, placeholders, search decorations, mathematics, diagrams and callouts.
- Theme variables and platform classes changed through classList operations.
- Runtime positions, dimensions and user-selected colors.
- Serialized HTML classes and print-document rules. Changes can affect an external document contract.
- Third-party component styling, reduced-motion rules and deliberate landing artwork.

Do not use the inventory as an automated deletion list.

## Suggested first implementation batch

Migrate ActivityIcon and ActivityBar styling. Reuse their existing components and delete only rules moved to those owners.

Before editing, inspect every matching native/print selector and caller. Record a fresh production CSS baseline with an approved `npm run browser:build`. Verify navigation, collapsed state, tooltip, badges, keyboard focus and themes with approved focused Playwright checks.

After editing, run focused tests, typecheck, formatting and active LSP diagnostics. Run the approved after-build and compare all emitted CSS assets' raw/gzip sizes. Measure JS-plus-CSS effects before claiming total payload savings.

Keep context-pane migration and collection-page extraction in separate batches. Leave unrelated command changes and known test failures outside scope.

## Activity-bar implementation checkpoint

The first batch is complete. ActivityIcon and ActivityBar now own their Tailwind
styling; their legacy activity-bar rules were removed from writeme.css. Existing
marker classes remain for native overrides and tests. No new wrapper component,
application behavior, dependency, or external contract was introduced.

| Production CSS measure      |  Before |   After | Reduction |
| --------------------------- | ------: | ------: | --------: |
| Main stylesheet, raw bytes  | 548,910 | 545,469 |     3,441 |
| Main stylesheet, gzip bytes |  79,401 |  79,198 |       203 |
| All emitted CSS, raw bytes  | 600,338 | 596,897 |     3,441 |
| All emitted CSS, gzip bytes |  91,108 |  90,905 |       203 |

Both production builds passed. The CSS compilation test, TypeScript check and
active LSP checks passed. Three focused Playwright cases passed: dark and light
styles/actions, native-web override hooks, print hiding, and coarse-pointer
sizing. The coarse-pointer check uses the wide layout; the activity rail is
intentionally hidden in the narrow-screen layout. Electron runtime and full
suites were not tested in this batch. These are CSS-only savings, not a measured
reduction of the total JavaScript-plus-CSS payload.

Next batch: context-pane styling, after a fresh baseline and scoped verification.
The assignment inventory below records the earlier audit and is not a live count.

## Unused CSS cleanup checkpoint

The cleanup batch removed 81 CSS lines and 12 `@apply` directives across
`writeme.css`, `native.css`, and `public/print.css`. Retired sidebar-v2 group/file
styles, collapsed-toggle styles, and editor-bubble styles had no remaining code
consumers. Their native/print selectors were removed as well. Duplicate shell
minimum-height and mobile header-action declarations were removed; existing
Tailwind utilities and base declarations retain the same values.

Ten unused `--wm-*` aliases and the now-unused native soft-glass alias were removed.
The four consumed `--wm-*` aliases remain, including `--wm-rail` used by Tailwind's
variable shorthand. This batch did not change SidebarNavigation or its remaining
navigation CSS; component migration remains a separate batch.

| Production CSS measure       |  Before |   After | Reduction |
| ---------------------------- | ------: | ------: | --------: |
| Main stylesheet, raw bytes   | 544,509 | 534,118 |    10,391 |
| Main stylesheet, gzip bytes  |  79,117 |  78,320 |       797 |
| Print stylesheet, raw bytes  |   6,279 |   6,222 |        57 |
| Print stylesheet, gzip bytes |   1,321 |   1,303 |        18 |
| All emitted CSS, raw bytes   | 595,937 | 585,489 |    10,448 |
| All emitted CSS, gzip bytes  |  90,824 |  90,009 |       815 |

Other source files changed during the initial builds. A controlled repeat using
the saved CSS baseline and current source reproduced the same asset hashes and
sizes, with no source changes during that repeat. The cleanup CSS was restored
before the final build. These measurements are CSS-only, not total application
payload savings.

The CSS compilation regression test, TypeScript, and five focused Playwright
cases passed. Browser checks cover dark/light themes, native-web override hooks,
shell heights, header sizing, 639/640/959/960px boundaries, coarse-pointer targets,
reduced motion, and print hiding. Full suites and Electron runtime were not run.
The package manifest was already valid on the follow-up check; no dependency or
lockfile changes were made in this batch.

Next batch remains context-pane styling with its existing component owners.

## File-by-file assignment inventory

“Inventory” means scanned, not a completed semantic review. “No literal match” does not certify Tailwind-only styling.

| File                                                                          | Assignments | Literal custom CSS matches | Review status / next check                                         |
| ----------------------------------------------------------------------------- | ----------: | -------------------------: | ------------------------------------------------------------------ |
| `index.html`                                                                  |           3 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/ai/ai-diff-view.tsx`                                 |           1 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/ai/ai-drawer.tsx`                                    |          20 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/ai/ai-file-attachment.tsx`                           |          13 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/ai/ai-message-item.tsx`                              |          24 |                          2 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/ai/ai-tooltip.tsx`                                   |          10 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/ai/markdown-chat-composer.tsx`                       |           6 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/ai/workspace-chat-details.tsx`                       |          62 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/commander.tsx`                                       |           5 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/add-to-group-dialog.tsx`                  |           8 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/alert.tsx`                                |           7 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/confirm.tsx`                              |           4 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/context-pane.tsx`                         |          32 |                         20 | Priority body reviewed                                             |
| `packages/editor/src/app/components/create-note-dialog.tsx`                   |           9 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/create-template-dialog.tsx`               |           3 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/create-variable-dialog.tsx`               |           8 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/directory-browser-dialog.tsx`             |          28 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/editor-drop-target.tsx`                   |           2 |                          2 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/editor-panes.tsx`                         |          22 |                          2 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/excalidraw-note-view.tsx`                 |           7 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/find-replace-bar.tsx`                     |          18 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/formatting-toolbar.tsx`                   |           4 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/git-sync-dialog.tsx`                      |          24 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/inspect-json-dialog.tsx`                  |           5 |                          0 | Test/fixture: preserve assertions and hooks                        |
| `packages/editor/src/app/components/json-dev-tools.tsx`                       |          16 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/json-editor.tsx`                          |           4 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/json-inspector-panel.tsx`                 |           4 |                          0 | Test/fixture: preserve assertions and hooks                        |
| `packages/editor/src/app/components/keyboard-click-hints.tsx`                 |           3 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/layout.tsx`                               |           1 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/motion-editor-tab.tsx`                    |           2 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/note-footer.tsx`                          |           9 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/note-history-dialog.tsx`                  |          28 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/note-list/note-list-sidebar.tsx`          |          43 |                          2 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/obsidian-importer.tsx`                    |          17 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/prompt.tsx`                               |           7 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/read-it-later-dialog.tsx`                 |           5 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/recent-notes-dialog.tsx`                  |          20 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/route-error-boundary.tsx`                 |           9 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/search-bar.tsx`                           |          17 |                          2 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/settings/ai-settings.tsx`                 |         103 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/settings/custom-variables.tsx`            |          15 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/settings/settings-controls.tsx`           |          12 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/shortcut-recorder.tsx`                    |           1 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/sidebar.tsx`                              |          18 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/sidebar/activity-bar.tsx`                 |           9 |                         10 | Priority body reviewed                                             |
| `packages/editor/src/app/components/sidebar/chat-sidebar-content.tsx`         |          14 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/sidebar/db-notes-tree.tsx`                |           9 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/sidebar/explorer-pane.tsx`                |          16 |                          4 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/sidebar/groups-pane.tsx`                  |          13 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/sidebar/quick-settings-pane.tsx`          |          12 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/sidebar/search-pane.tsx`                  |          27 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/sidebar/sidebar-navigation.tsx`           |          16 |                          8 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/sidebar/sidebar-shell.tsx`                |          23 |                          3 | Priority body reviewed                                             |
| `packages/editor/src/app/components/sidebar/tags-pane.tsx`                    |          10 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/sidebar/templates-pane.tsx`               |          45 |                          2 | Priority body reviewed                                             |
| `packages/editor/src/app/components/sidebar/trash-pane.tsx`                   |          15 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/table-of-contents.tsx`                    |          12 |                          4 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/tabs-bar.tsx`                             |          13 |                          4 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/tags-graph.tsx`                           |           1 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/tasks-dialog.tsx`                         |          26 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/terminal/terminal-panel.tsx`              |           4 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/terminal/terminal-workspace.tsx`          |           2 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/theme-toggle.tsx`                         |           2 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/tree-view.tsx`                            |          18 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/tree-view/tree-node-item.tsx`             |          16 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/views/column-picker.tsx`                  |           4 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/views/filter-builder.tsx`                 |          10 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/views/query-code-editor.tsx`              |           5 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/views/view-table.tsx`                     |          15 |                          2 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/components/workspace-folder-autocomplete.tsx`        |          12 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/components/workspace-setup.tsx`                      |          31 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/editor.tsx`                                          |           8 |                          4 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/elements/callout.tsx`                                |           1 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/elements/code-block.tsx`                             |           4 |                          2 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/elements/code-block/code-block-header.tsx`           |          15 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/elements/code-block/code-block-rendered.tsx`         |          10 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/elements/code-block/codemirror-node-code-editor.tsx` |           1 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/elements/code-block/excalidraw.tsx`                  |           2 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/elements/code-block/execution-output.tsx`            |          10 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/elements/code-block/flowchart.tsx`                   |           7 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/elements/code-block/freehand.tsx`                    |          11 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/elements/code-block/graphviz.test.tsx`               |           2 |                          1 | Test/fixture: preserve assertions and hooks                        |
| `packages/editor/src/app/elements/code-block/graphviz.tsx`                    |           8 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/elements/code-block/latex-block.tsx`                 |           2 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/elements/code-block/math-block.tsx`                  |          13 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/elements/code-block/mermaid.tsx`                     |           2 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/elements/color-code.tsx`                             |           4 |                          5 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/elements/color-replacer.tsx`                         |           1 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/elements/frontmatter-builder.tsx`                    |          11 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/elements/frontmatter.tsx`                            |           9 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/elements/json-graph/json-graph.tsx`                  |          13 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/elements/json-graph/json-node.tsx`                   |          15 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/elements/link-preview.tsx`                           |           9 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/elements/mention.tsx`                                |           4 |                          2 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/elements/raw-markdown-editor.tsx`                    |           2 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/elements/youtube-block.tsx`                          |           4 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/extensions.tsx`                                      |           3 |                          3 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/extensions/asset-cleanup.tsx`                        |           2 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/extensions/domain-link.tsx`                          |           2 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/extensions/emoji-picker.tsx`                         |           5 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/extensions/hashtag.ts`                               |           1 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/extensions/image-extension.tsx`                      |          23 |                          4 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/extensions/link-mark.tsx`                            |           1 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/extensions/pdf-extension.tsx`                        |          10 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/extensions/slash-command.tsx`                        |          18 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/extensions/suggestion.tsx`                           |          11 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/extensions/tiptap-markdown/parse/MarkdownParser.ts`  |           4 |                          3 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/extensions/video-extension.tsx`                      |          11 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/hooks/use-note-list.ts`                              |           2 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/layouts/main.layout.tsx`                             |          18 |                         13 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/layouts/sidebar.tsx`                                 |           4 |                          6 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/main.tsx`                                            |           4 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/about.page.tsx`                                |          21 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/calendar.page.tsx`                             |          11 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/chat.page.tsx`                                 |          35 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/pages/dashboard.page.tsx`                            |          80 |                          4 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/pages/examples.page.tsx`                             |           4 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/floating-editor.page.tsx`                      |           1 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/floating-note.page.tsx`                        |           7 |                          2 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/pages/folder-workspace.page.tsx`                     |          18 |                          2 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/pages/gist-import.page.tsx`                          |          13 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/group-detail.page.tsx`                         |          29 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/groups-list.page.tsx`                          |          20 |                          0 | Priority body reviewed                                             |
| `packages/editor/src/app/pages/migrate.page.tsx`                              |          13 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/note.page.tsx`                                 |          38 |                         30 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/pages/notes-list.page.tsx`                           |          46 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/pages/oauth-callback.page.tsx`                       |           7 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/read-it-later.page.tsx`                        |          14 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/settings.page.tsx`                             |          58 |                          8 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/pages/settings/settings-ai.page.tsx`                 |           1 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/settings/settings-appearance.page.tsx`         |           1 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/settings/settings-editor.page.tsx`             |           1 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/settings/settings-migration.page.tsx`          |           4 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/settings/settings-not-found.page.tsx`          |           1 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/settings/settings-page-shell.tsx`              |           9 |                          2 | Priority body reviewed                                             |
| `packages/editor/src/app/pages/settings/settings-quick.page.tsx`              |           3 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/settings/settings-shortcuts.page.tsx`          |          11 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/pages/settings/settings-templates.page.tsx`          |          45 |                          2 | Priority body reviewed                                             |
| `packages/editor/src/app/pages/settings/settings-trash.page.tsx`              |           1 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/settings/settings-variables.page.tsx`          |           1 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/settings/settings-workspace.page.tsx`          |           8 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/share.page.tsx`                                |           5 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/tag.page.tsx`                                  |           8 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/tags.page.tsx`                                 |           5 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/editor/src/app/pages/template.page.tsx`                             |          16 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/pages/view-detail.page.tsx`                          |          11 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/pages/views-list.page.tsx`                           |          19 |                          0 | Priority body reviewed                                             |
| `packages/editor/src/app/root-layout.tsx`                                     |           6 |                          2 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/tutorial/shortcuts-commands.tsx`                     |           9 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/app/writing-assistant/writing-assistant.tsx`             |          45 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/editor/src/lib/read-it-later-utils.test.ts`                         |           3 |                          0 | Test/fixture: preserve assertions and hooks                        |
| `packages/editor/src/store/global.store.homedir.test.ts`                      |           1 |                          0 | Test/fixture: preserve assertions and hooks                        |
| `packages/landing/app/layout.tsx`                                             |           1 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/landing/app/page.tsx`                                               |          61 |                          7 | Inventory: map rules to owners; check native/print/generated uses  |
| `packages/landing/components/ui/button.tsx`                                   |           1 |                          0 | Inventory: no literal match; inspect dynamic values and repetition |
| `packages/landing/components/ui/hexagon.tsx`                                  |           7 |                          1 | Inventory: map rules to owners; check native/print/generated uses  |

## Additional class-reference files

These include DOM integration, generated content, theme control, tests and configuration. They are not all UI component candidates.

- `oxfmt.config.ts`
- `packages/editor/src/app/elements/code-block/editor-themes.ts`
- `packages/editor/src/app/elements/shortcut-items.tsx`
- `packages/editor/src/app/extensions/search-replace.ts`
- `packages/editor/src/app/extensions/tiptap-markdown/extensions/nodes/task-list.ts`
- `packages/editor/src/app/extensions/tiptap-markdown/extensions/tiptap/tight-lists.ts`
- `packages/editor/src/app/extensions/writing-assistant.ts`
- `packages/editor/src/app/writing-assistant/markdown-adapter.ts`
- `packages/editor/src/lib/print-document.ts`
- `packages/editor/src/lib/read-it-later-utils.ts`
- `packages/editor/src/store/global.store.ts`
- `packages/editor/src/store/tabs.test.ts`
