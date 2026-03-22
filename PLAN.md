╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Plan to implement                                                                                                                    │
│                                                                                                                                      │
│ Refactor & Simplify — Dead Code, Deduplication, Inconsistencies                                                                      │
│                                                                                                                                      │
│ Context                                                                                                                              │
│                                                                                                                                      │
│ The codebase has accumulated dead exports, duplicated patterns across files, and minor inconsistencies. This refactor cleans up all  │
│ three categories without restructuring large files. Every change is independently verifiable.                                        │
│                                                                                                                                      │
│ 1. Dead Code Removal                                                                                                                 │
│                                                                                                                                      │
│ 1. Remove cleanPastedHTML + removeEmptyWrappers from src/app/extensions.tsx — exported, never imported                               │
│ 2. Remove resetHighlighter from src/app/elements/code-block.tsx — exported, never imported                                           │
│ 3. Remove onPasteRawText prop from src/app/editor.tsx — defined in types and threaded through but never used in InnerEditor          │
│ 4. Remove empty BubbleMenu from src/app/editor.tsx — renders empty <ul>, remove import too                                           │
│ 5. Consolidate Toggle<T> type — defined independently in both src/store/global.store.ts (line 14) and src/store/ui.store.ts (line    │
│ 75). Move to src/store/types.ts, import from there in both files                                                                     │
│ 6. Remove duplicate animation keyframes from tailwind.config.ts (lines 90-103) — keep the CSS versions in src/index.css which use    │
│ var(--transition-normal)                                                                                                             │
│ 7. Remove unused currency re-exports from src/lib/currency/index.ts — remove formatLoadingPlaceholder, formatErrorMessage,           │
│ formatConversionResultWithSymbols, formatConversionResultWithRate, getCurrencySymbol from barrel export (keep functions in           │
│ formatter.ts)                                                                                                                        │
│                                                                                                                                      │
│ 2. Code Deduplication                                                                                                                │
│                                                                                                                                      │
│ 8. Remove duplicate trailingPath/join from src/lib/read-it-later-utils.ts (lines 60-72) — these are dead code in that file,          │
│ canonical versions live in src/lib/encoding.ts                                                                                       │
│ 9. Extract updatePosition to src/app/extensions/update-position.ts — duplicated in src/app/extensions/suggestion.tsx (lines 127-146) │
│  and src/app/extensions/slash-command.tsx (lines 411-430). Import from shared file in both                                           │
│ 10. Extract useThemeChange hook to src/app/hooks/use-theme-change.ts — MutationObserver on document.documentElement class changes,   │
│ duplicated in mermaid.tsx (269-280), graphviz.tsx (112-119), flowchart.tsx (121-128)                                                 │
│ 11. Extract useLocalAsset hook to src/app/hooks/use-local-asset.ts — local asset loading (isElectron, readBinaryFile,                │
│ createObjectURL) duplicated across image-extension.tsx, video-extension.tsx, pdf-extension.tsx                                       │
│ 12. Consolidate trivially-duplicate repositories — settings, projects, and scripts each have browser/electron versions differing     │
│ only by adapter class                                                                                                                │
│   - Settings & Projects: pure constructor-only, no overrides — pass adapter to constructor instead                                   │
│   - Scripts: has getOne/getAll overrides calling Script.parse() — same approach, pass adapter                                        │
│   - Create src/store/repositories/shared/settings.repository.ts, projects.repository.ts, scripts.repository.ts                       │
│   - Delete 6 files from browser/ and electron/ dirs                                                                                  │
│   - Update factory in src/store/repositories/index.ts                                                                                │
│                                                                                                                                      │
│ 3. Fix Inconsistencies                                                                                                               │
│                                                                                                                                      │
│ 13. Type editor.storage — create src/lib/editor-storage.ts with typed getEditorStorage(editor) helper. Replace (editor.storage as    │
│ any) in 7 locations: editor.tsx (4x), suggestion.tsx, commander.tsx, frontmatter.tsx, ai-tooltip.tsx, ai-drawer.tsx                  │
│ 14. Remove dead sidebar state from ui.store — sidebarWidth in src/store/ui.store.ts is never read anywhere. Remove from type,        │
│ initial state, persisted state, and setSidebarWidth action. Global store's sidebar state is the authoritative one.                   │
│ 15. Rename render-tiptap-to-markdown.ts to render-tiptap-to-html.ts — file actually renders HTML (comment in file acknowledges       │
│ this). Rename export tiptapToMarkdown → tiptapToHtml. Update import in editor.tsx                                                    │
│ 16. Move parseHslaToHex from src/lib/editor-utils.ts to src/lib/color-utils.ts — unrelated to editor utilities. Update imports in    │
│ graphviz.tsx, flowchart.tsx, json-graph.tsx                                                                                          │
│ 17. Fix relative import in src/app/commands/clipboard-listener.command.ts — uses ../../ipc/copy-event instead of @/ipc/copy-event    │
│                                                                                                                                      │
│ Files most touched                                                                                                                   │
│                                                                                                                                      │
│ - src/app/editor.tsx — items 3, 4, 13, 15                                                                                            │
│ - src/store/ui.store.ts — items 5, 14                                                                                                │
│ - src/store/global.store.ts — item 5                                                                                                 │
│ - src/store/repositories/index.ts — item 12                                                                                          │
│ - src/app/extensions/suggestion.tsx — items 9, 13                                                                                    │
│                                                                                                                                      │
│ Verification                                                                                                                         │
│                                                                                                                                      │
│ - npm run lint && npm run test after each batch                                                                                      │
│ - npm run browser:dev at the end to verify the app starts                                                                            │
│                                                                                                                                      │
│ Unresolved questions                                                                                                                 │
│                                                                                                                                      │
│ - None — all details verified via file reads and grep                                                                                │

