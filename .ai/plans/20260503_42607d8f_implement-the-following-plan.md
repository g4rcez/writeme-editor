# Implement the following plan:

_Session: 42607d8f-97be-4af5-9498-1815c465f334 | Saved: 2026-05-03 15:20:19_

## Prompt

Implement the following plan:

Context: a previous pass cleared 65 mechanical TypeScript errors and left 221, deferred as out-of-scope. The remaining errors are not random — they cluster around (a) the inlined `tiptap-markdown` fork at `src/app/extensions/tiptap-markdown/**` which was written for tiptap v2 conventions and now lights up under v3's stricter `Storage` interface and prosemirror-markdown's typed signatures, (b) a `noUncheckedIndexedAccess` strict-null cluster in product code that's almost entirely 1-line mechanical fixes, (c) two stale `TS2305` imports (one dead file, one local destructuring bug), and (d) a handful of genuine bugs and API drift sites. The goal of this pass is to bring the repo to 0 `tsc --noEmit` errors without behavioural changes, prepping the codebase for `typecheck` to be a CI gate.

Plan steps

1. Kill the two TS2305 errors first (smallest, highest signal-to-noise)
   - delete `src/app/ai/chat-adapter.ts` outright — `createChatAdapter` is not exported by `@tanstack/ai-react@0.7.2` (verified against `node_modules/@tanstack/ai-react/dist/esm/index.d.ts`), the file's own comments admit it's a placeholder, and a grep across `src/` confirms zero consumers of `aiAdapter`
   - in `src/app/components/sidebar/sidebar-navigation.tsx`: remove `layoutDispatch` from the line-8 import; in `SidebarNavigation` change the `useLayoutStore` call to destructure dispatch from the tuple, e.g. `const [{ activeView }, layoutDispatch] = useLayoutStore((s) => ({ activeView: s.activeView }));` — matches the pattern already used in `note-list-sidebar.tsx:169`, `search-pane.tsx:11`, `tags-pane.tsx:7`. `layoutDispatch` is referenced at lines 88, 95, 102, 113 inside the component, so the destructured local satisfies all of them

2. Module-augment tiptap to teach it about the markdown storage (single block, kills ~10 TS2339 across the whole repo)
   - in `src/app/extensions/tiptap-markdown/Markdown.ts`, add a `declare module "@tiptap/core"` block with: `interface Storage { markdown: { options: MarkdownOptions; parser: MarkdownParser | null; serializer: MarkdownSerializer | null; getMarkdown: (() => string) | null } }`, `interface Editor { getMarkdown(): string }`, `interface EditorOptions { initialContent?: Content }`
   - this kills the 4 `extensions/tiptap/clipboard.ts` errors (lines 37, 56, 88, 105), the 3 `Markdown.ts` `initialContent`/`getMarkdown` errors (lines 141, 143, 150-151), and the 4 `editor.tsx` `getMarkdown`/`storage.markdown` errors (lines 206, 238, 277, 301)
   - drop the `as any` shims now made unnecessary: `src/lib/editor-storage.ts:19` (`(editor.storage as any).markdown.getMarkdown()` → `editor.storage.markdown.getMarkdown!()`), `src/app/components/read-it-later-dialog.tsx:46` (same shape)

3. Type the tiptap-markdown sub-extensions against prosemirror-markdown's real signatures (kills ~74 TS7006 + cascading TS2339)
   - create `src/app/extensions/tiptap-markdown/serialize/types.ts` with shared aliases derived from real upstream types (no fabrication — verified at `node_modules/prosemirror-markdown/dist/index.d.ts:131-206`): `MarkdownSerializerState` and `MarkdownSerializer` re-exported from `@tiptap/pm/markdown`; `Node` and `Mark` re-exported from `@tiptap/pm/model`; alias `SerializeContext = { editor: Editor; options: any }`; alias `NodeSerialize = (this: SerializeContext, state: MarkdownSerializerState, node: Node, parent: Node, index: number) => void`; alias `MarkSerializeFn = (this: SerializeContext, state: MarkdownSerializerState, mark: Mark, parent: Node, index: number) => string`
   - annotate the 15 sub-extension files in `extensions/marks/**` and `extensions/nodes/**` — each `serialize(state, node, parent, index)` becomes `serialize(state: MarkdownSerializerState, node: Node, parent: Node, index: number)`; each mark `open`/`close` either gets the same annotation or uses `MarkSerializeFn` directly
   - on the mark/node files that touch `this.editor.storage.markdown.options.html` (`extensions/marks/html.ts:14, :23`, `extensions/nodes/html.ts:11`, etc.), add an explicit TypeScript `this` parameter — `function open(this: SerializeContext, state: MarkdownSerializerState, mark: Mark)` — which resolves the TS2339 on `this.editor` since `MarkdownSerializer.serializeMark` (`MarkdownSerializer.ts:81-84`) explicitly `.bind({ editor, options })` at call time
   - annotate `node.forEach` callbacks in `extensions/nodes/table.ts:22, :24` and helper utilities `hasSpan(node)`, `isMarkdownSerializable(node)`, `childNodes(node)` (in `util/prosemirror.ts:1`) with `Node` / `Node[]`
   - read each file before editing — there are 15 sub-extension files plus utils, easy to slip on copy/paste

4. Fix the custom MarkdownSerializerState subclass (~7 errors in `serialize/state.ts` + 1 in `MarkdownSerializer.ts:20`)
   - in `src/app/extensions/tiptap-markdown/serialize/state.ts`: declare the missing instance fields explicitly — `inlines: Array<{ start: number; end?: number; delimiter: string }> = [];` next to existing `inTable = false`; declare `out!: string;` (prosemirror-markdown's internal `out` field is implementation-detail, deliberately omitted from the public d.ts but always present at runtime — definite-assignment is the honest fix here, not a cast)
   - annotate the constructor (`constructor(nodes: Node[], marks: Mark[], options: ConstructorParameters<typeof MarkdownSerializerState>[2])` or use `ConstructorParameters` to derive); annotate `render` and `markString` overrides with the typed signatures from step 3
   - annotate `normalizeInline(inline: { start: number; end: number; delimiter: string })`
   - the TS2554 "expected 0 arguments" on the `super()` call at line 12 disappears once the constructor params are typed (it's a downstream symptom of implicit-any, not a real arity error)

5. Tighten the parser/serializer null fields (~13 errors in `MarkdownParser.ts`, `MarkdownSerializer.ts`, `extensions/nodes/html.ts`)
   - in `src/app/extensions/tiptap-markdown/parse/MarkdownParser.ts`: change `editor: Editor | null` and `md: Marked | null` to definite-assignment-asserted (`editor!: Editor`, `md!: Marked`) or initialise them inline in the constructor — they are never null at use sites
   - in `src/app/extensions/tiptap-markdown/serialize/MarkdownSerializer.ts:8`: same treatment for the editor field
   - in `src/app/extensions/tiptap-markdown/extensions/nodes/html.ts:52-56`: the `element` from `document.createElement(...)` is genuinely non-null after construction — non-null assertion or guard, depending on which sibling code reads cleaner

6. Fix the small genuine API-drift inside tiptap-markdown (2 errors in `extensions/tiptap/tight-lists.ts`)
   - line 32 `addCommands` return-type and line 42 "expression not callable" — the v3 `addCommands` callback shape is `() => Partial<RawCommands>`; the current shape probably needs the inner command to return `boolean`. Read the file first, then either align the signature to the v3 type or add a `Partial<RawCommands>` return annotation. If the failure persists, fall back to a localised `as Partial<RawCommands>` cast with an inline comment

7. Decide and apply the NoteType enum policy (6 errors across 5 files)
   - choice: widen `Note.new(title, content, noteType, ...)` and the `Note` constructor in `src/store/note.ts` to accept `NoteType | \`${NoteType}\`` (template-literal-typed string union derived from the enum) — this is one edit at the source and avoids touching every call site; commit to this approach
   - update `Note.new` body to coerce: `noteType: noteType as NoteType` is acceptable since the runtime values are the same string literals
   - in `src/store/global.store.ts:15`, ensure `NoteCreationType = "note" | "quick"` remains compatible — it already is under the widened signature
   - this clears `create-note-dialog.tsx:78`, `create-template-dialog.tsx:37`, `read-it-later-dialog.tsx:51`, `quicknote.page.tsx:24`, `note.test.ts:19,33,55`

8. Theme narrowing (2 errors)
   - `src/app/ai/ai-diff-view.tsx:43`: replace `diffViewTheme={theme}` with `diffViewTheme={theme === "light" ? "light" : "dark"}` — the catppuccin-mocha and tokyonight-night variants are both dark
   - `src/app/elements/excalidraw.tsx:49`: same narrowing for Excalidraw's `Theme` prop (`"light" | "dark"`)

9. Test-only fixture fixes (10 + 3 errors, pure mechanical)
   - `src/app/elements/excalidraw.test.tsx:20, 33, 45`: pass `autoDelete={vi.fn()}` (or `() => {}`) to each of the 3 `<ExcalidrawCode … />` renders — it's a required prop
   - `src/app/components/tasks-dialog.test.tsx:62-69` and similar lines: append `!` to all 10 `stacks[0]`/`stacks[0].cards[0]` accesses, OR — preferred — add a tiny local helper `const assertDefined = <T>(v: T | undefined): T => { if (v === undefined) throw new Error("expected defined"); return v; };` and wrap once. Keep the file change small; favour `!` if the helper would balloon the diff
   - `src/store/note.test.ts:19,33,55`: covered by step 7

10. Genuine semantic bugs (don't paper over with casts)
    - `src/app/elements/table.tsx:10` (TS2322 + collateral TS18048 at 12, 16): the `InputRule` `handler` is returning `tr` but the v3 signature expects `void | null`. Remove the explicit `return tr`, mutate via the `state.tr` accessor in-place, and add a guard `if (!headerRow || !bodyRows) return null;` at the top to satisfy the TS18048s on the destructured match groups
    - `src/app/elements/task-list-item.tsx:215` (TS2322): `addPasteRules()` is currently calling `wrappingInputRule(...)` which returns an `InputRule[]`. Paste rules require the paste-rule constructors from `@tiptap/core`. Read the file first; replace with the matching paste-rule helper if a direct equivalent exists, otherwise convert the regex into the form expected by the paste-rule API — this is the only spot that may need 5+ lines of real code rather than a type tweak

11. One-off API drift (3 errors)
    - `src/app/components/recent-notes-dialog.tsx:42`: `storageDirectory` access on settings — open the settings type, find the new field name (likely `directory` per `globalState().directory` usage in `use-local-asset.ts`), update the access
    - `src/app/elements/callout.tsx:155`: `Property 'withText' does not exist on type 'Node'` — prosemirror's `withText` was on a `TextSelection`, not `Node`; read the surrounding code, and either replace with the v3 equivalent or restructure the call. May need to `editor.chain().setNode(...)` instead
    - `src/app/editor.tsx:63`: `addEventListener("@writeme/copy-events.dispatched", …)` overload failure — augment `WindowEventMap` in a small `declare global` block (colocated with the dispatcher) so the listener is typed end-to-end

12. Strict-null mechanical pass (~80 errors, 85% trivial)
    - high-ROI files (handle these first to collapse the count fast):
       - `src/app/ai/ai-drawer.tsx` — single `if (!msg) return null;` at the top of the row renderer kills 10
       - `src/app/components/tasks-dialog.test.tsx` — covered in step 9
       - `src/app/pages/tags.page.tsx` — `m[1]!` / `m[2]!` on the `matchAll` results at lines 68, 73 (regex guarantees the captures), kills 6
       - `src/lib/url-utils.ts` — change `let id: string | null` to `let id: string | null | undefined` at the top of `parseAsanaUrl` (or use `?? null` on each assignment), kills 5
       - `src/lib/encoding.ts` — 4 remaining `!` on indexed accesses where loop bounds guarantee presence
       - `src/app/components/sidebar/db-notes-tree.tsx`, `src/lib/currency/parser.ts`, `src/app/hooks/use-note-list.ts`, `src/app/elements/code-block.tsx`, `src/app/elements/callout.tsx`, `src/app/pages/notes-list.page.tsx`, `src/app/elements/youtube-block.tsx`, `src/app/editor.tsx`, `src/lib/template-utils.ts` — 1-3 errors each, all 1-line fixes
    - the residual ~12 errors that need design judgment:
       - `useNoteList`/`notes-list.page.tsx`/`db-notes-tree.tsx` — `tagCount: number` required by `NoteWithTags` but source returns `Note[]`. Decision: make `NoteWithTags.tagCount` optional (the read sites all default to 0 already in render), changed in one place at the type definition
       - `gemini.adapter.ts:32` — `AuthCredentials` shape mismatch on `{ message: string }`; align the failure return shape to the credentials type
       - `editor.tsx` `setContent({ contentType })` and `extensions.tsx:368` `MentionOptions.markdown` — these are unknown-property TS2353s; either drop the unknown key or augment the option type
    - run `npx tsc --noEmit | grep -cE "^src/.*error TS"` after each cluster — error count must monotonically decrease

13. Verification (must all pass before claiming done)
    - `npx tsc --noEmit 2>&1 | grep -cE "^src/.*error TS"` — must report 0
    - `npx prettier --check "src/**/*.{ts,tsx}"` — must pass
    - `npm run test` — all 365 tests must still pass; if any newly fail, the change for that file is wrong
    - `npm run dev` — Electron app boots; smoke-test the affected features manually:
       - markdown round-trip: type some markdown, switch tabs, switch back — content must serialise/deserialise identically (proves the tiptap-markdown annotations are non-behavioural)
       - sidebar navigation: click between activity views — proves the `sidebar-navigation.tsx` dispatch fix
       - AI drawer: open it, send a prompt, scroll the response — proves the `msg` guard didn't change the render path
       - create note / quick note / template / read-it-later — proves NoteType widening works at runtime
       - dark theme: switch theme to catppuccin-mocha, open a diff view and an excalidraw — proves theme narrowing maps correctly
    - commit shape: one commit per cluster (steps 1-12 are 12 commits) so each is independently revertable; commit messages should reference the cluster name

Critical files
- `src/app/ai/chat-adapter.ts` (delete)
- `src/app/components/sidebar/sidebar-navigation.tsx`
- `src/app/extensions/tiptap-markdown/Markdown.ts` (module augmentation lives here)
- `src/app/extensions/tiptap-markdown/serialize/types.ts` (create)
- `src/app/extensions/tiptap-markdown/serialize/state.ts`
- `src/app/extensions/tiptap-markdown/serialize/MarkdownSerializer.ts`
- `src/app/extensions/tiptap-markdown/parse/MarkdownParser.ts`
- `src/app/extensions/tiptap-markdown/extensions/marks/{bold,code,html,italic,link,strike}.ts`
- `src/app/extensions/tiptap-markdown/extensions/nodes/{blockquote,bullet-list,code-block,hard-break,heading,horizontal-rule,html,image,list-item,ordered-list,paragraph,table,task-item,task-list,text}.ts`
- `src/app/extensions/tiptap-markdown/extensions/tiptap/{clipboard,tight-lists}.ts`
- `src/app/extensions/tiptap-markdown/util/prosemirror.ts`
- `src/lib/editor-storage.ts`, `src/app/components/read-it-later-dialog.tsx` (drop `as any`)
- `src/store/note.ts` (NoteType widening)
- `src/app/ai/ai-diff-view.tsx`, `src/app/elements/excalidraw.tsx` (theme narrowing)
- `src/app/elements/excalidraw.test.tsx`, `src/app/components/tasks-dialog.test.tsx` (test fixtures)
- `src/app/elements/table.tsx`, `src/app/elements/task-list-item.tsx` (genuine bugs)
- `src/app/components/recent-notes-dialog.tsx`, `src/app/elements/callout.tsx`, `src/app/editor.tsx` (one-off API drift)
- the ~15 strict-null fix files listed in step 12

Open questions
- step 7 NoteType: confirm preference for widening at source (`NoteType | \`${NoteType}\``) vs. updating each call site to use enum members. Current plan picks widening; flag if you'd rather touch the call sites
- step 10 task-list-item: if there's no clean paste-rule equivalent of `wrappingInputRule`, fallback is to drop `addPasteRules` for that specific rule (paste-from-markdown still flows through the markdown pipeline). Confirm this is acceptable
- step 11 callout `withText`: depending on what the call was meant to do, the fix may be a 2-line restructure or may expose a deeper feature gap. Confirm whether to apply minimal v3 equivalent or open an issue if the feature can't be expressed cleanly
- step 13 commits: confirm 12 small commits is preferred over a single squash. The work is sequential and commits-as-rollback-units is the more defensible shape


If you need specific details from before exiting plan mode (like exact code snippets, error messages, or content you generated), read the full transcript at: /Users/garcez/.claude/projects/-Users-garcez-Documents-g4rcez-writeme-editor/450d563c-b9e9-4540-bc39-36cf1850d8d6.jsonl

## Plan

Given the scope (221 errors, 55+ files), I'll use the dev agent to execute this systematically.

