# Plan 016: Improve writing, finding, and linking without losing calm

> **Recommendation:** Keep the current workbench layout. First fix context-panel focus behavior and link consistency, then improve finding and daily capture. Add backlinks before a note graph or plugin system.
>
> This is a product and design plan, not permission to change application code. Implement one phase at a time after approval. Do not interpret the roadmap as approval for migrations, new dependencies, paid AI requests, or changes to external formats.
>
> **Drift check:** Run `git diff --stat 7487a26..HEAD -- packages/editor/src/app packages/editor/src/lib tests/e2e PRODUCT.md DESIGN.md`. Compare changed files with the evidence below before implementation. Stop if the relevant behavior no longer matches.

## Status

- **Priority:** P2 overall; the context-panel accessibility work is first.
- **Effort:** L for the complete roadmap; phases are separately scoped below.
- **Risk:** MED; link identity and file compatibility need special care.
- **Depends on:** None for layout and link UI work. Plan 015 remains independently blocked; this plan does not resolve credential migration.
- **Category:** direction
- **Planned at:** commit `7487a26`, 2026-10-08
- **Implementation status:** IN PROGRESS — core Phase 1–5 changes and focused automated verification are in place; responsive screenshots and an actual 200% browser-zoom review are complete; the intended-user task study and screen-reader session remain outstanding.

## 1. Product decision

Write Me should make the sequence **writing → finding → linking** easier for solo builders. It should not become an Obsidian clone or expose every tool at once.

`PRODUCT.md` describes a calm, structured, trustworthy workspace with AI as an optional collaborator. `DESIGN.md` calls for a quiet personal knowledge workbench, keyboard-first access, and restrained atmosphere on home and AI surfaces. Preserve those constraints.

Learn from Obsidian's connected-note workflows, discoverable commands, and workspace control. Keep Write Me's integrated tools where they help its own audience. Do not claim that Obsidian lacks equivalent capabilities through plugins.

### Is the current layout good for users?

**The structure is a good starting point; usability is not yet proven.** The rail, explorer, tabs, writing surface, and optional context panel fit the product. A complete visual redesign is not justified by this inspection.

There are concrete reasons to refine the layout:

- The context panel is styled as a desktop column but always declares modal semantics and contains focus-trap logic.
- The header promises “Find anything” but opens a note command mode whose inspected note entries are title-based.
- Linked notes appear both in the context panel and beneath a note, with separate resolution code.
- Narrow-screen pane exclusion already exists. Improve and test it rather than replacing it.

A real task-based review is still required. `public/screenshot-wide.png` is a placeholder illustration, not proof of the current editor experience. Runtime screenshots were later captured and visually reviewed (see Screenshot review); no user study or screen-reader session has been completed for this plan.

## 2. Current capabilities: improve, do not rebuild

The following findings come from source inspection. “Present” means implemented code was found, not that every interaction passed runtime verification.

| Area                | Observed state                                                                                                           | Direction                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Workspace shell     | `MainLayout` renders sidebar, tabs, terminal workspace, and optional context panel.                                      | Preserve the shell; improve focus, labels, and responsive behavior.                       |
| Outline             | `ContextPane` observes rendered headings and scrolls to them.                                                            | Keep it; validate editor modes, long notes, reduced motion, and navigation.               |
| Note links          | Context panel and note footer both calculate outgoing links. A shared Obsidian link parser handles aliases and subpaths. | Make resolution consistent; add incoming links after identity rules are tested.           |
| Properties and tags | Context shows type, timestamps, location, and deduplicated tags.                                                         | Improve metadata access; inventory other editors before adding another properties UI.     |
| Commands            | `Commander` lists notes and open tabs, including AI chat and terminal tabs.                                              | Clarify quick switching versus content search; keep one keyboard entry point.             |
| Daily capture       | Floating quick notes already get or create one note for a day, with desktop-file and repository paths.                   | Connect this workflow to normal navigation; do not create a second daily-note model.      |
| Templates           | `useTemplates` loads repository templates and synchronizes desktop Markdown templates.                                   | Improve discovery and application; do not add a second template store.                    |
| History             | History dialog lists local snapshots, previews content, confirms restore, and reports failures.                          | Improve comparison and recovery confidence; do not propose history as a missing feature.  |
| Obsidian import     | Desktop importer selects a vault, copies into a separate destination, and skips existing destination files.              | Validate fidelity and explain limits; do not promise complete vault/plugin compatibility. |

### Evidence for the first changes

**E1 — Desktop versus modal context**

`packages/editor/src/app/components/context-pane.tsx`, `ContextPane`:

```tsx
<dialog
    open
    className="writeme-context-pane m-0 p-0"
    aria-modal="true"
```

The same component focuses its close button on mount and implements Tab wrapping without a viewport condition. `packages/editor/src/app/styles/writeme.css` gives the default panel `relative ... w-72 ... border-l`; its narrow-screen rules position the panel over the workspace. This is a source-level semantic mismatch, not a completed assistive-technology test. Also, change the `dialog` to use the `Modal` component from our design system

**E2 — Link parsing differs between surfaces**

`packages/editor/src/app/components/context-pane.tsx` collects the entire wiki-link body:

```ts
/\[\[([^\]]+)\]\]|app:\/\/note\/([^\s<>"')\]]+)/g;
```

It then matches that value directly against candidate IDs or titles. `packages/editor/src/app/pages/note.page.tsx`, `useNoteReferences`, similarly looks up the raw wiki-link body in title/ID maps.

In contrast, `packages/editor/src/lib/obsidian-links.ts`, `parseObsidianLink`, already separates the alias and heading/block subpath:

```ts
const [targetPart, aliasPart] = splitOnce(rawBody, "|");
const subpathMatch = targetWithSubpath.match(/([#^].*)$/);
const target = subpath ? targetWithSubpath.slice(0, -subpath.length).trim() : targetWithSubpath;
```

Thus `[[Project|Roadmap]]` or `[[Project#Next steps]]` is not resolved like `[[Project]]` by the inspected outgoing-link lists. Confidence is high in this code inconsistency; reproduce it in tests before changing behavior.

Centralize those parsers in one place, allowing to read in a more reliable way which things are parsed and their transformers

**E3 — Search promise versus quick switching**

`packages/editor/src/app/layouts/main.layout.tsx`:

```tsx
aria-label="Find anything"
onClick={() => dispatch.commander(true, CommanderType.Notes)}
```

`packages/editor/src/app/commander.tsx`, `noteGroup`, constructs note entries from `note.title`. This establishes title-based switching in this path. It does **not** establish that content search is absent elsewhere.

**E4 — Daily notes and templates already exist**

`packages/editor/src/app/pages/floating-note.page.tsx`, `getOrCreateDailyQuickNote`, uses `startOfDay(date)`, `getDailyQuickNotePath`, and `repositories.notes.getQuicknoteByDate(day)` before creating a note.

`packages/editor/src/app/hooks/use-templates.ts` calls `repositories.notes.getTemplates()` and synchronizes Markdown files into `NoteType.template` records on desktop.

**E5 — History already supports preview and confirmation**

`packages/editor/src/app/components/note-history-dialog.tsx` renders a “Read-only preview” of `selectedSnapshot.content`. Restore calls `repositories.notes.restoreSnapshot(note.id, snapshot.id)`. Its confirmation says that current content will be preserved in local history; verify that repository guarantee before changing recovery UI.

**E6 — Import has existing safety boundaries**

`packages/editor/src/app/components/obsidian-importer.tsx`, `importVault`, rejects a destination inside the source vault, validates relative paths, and increments `skipped` when a destination file exists. Preserve these boundaries.

## 3. Obsidian comparison and evidence limits

Use these official documentation pages as implementation research inputs:

- [Backlinks](https://help.obsidian.md/plugins/backlinks): benchmark incoming links and contextual references.
- [Workspaces](https://help.obsidian.md/plugins/workspaces): benchmark switching between writing and research arrangements.
- [File recovery](https://help.obsidian.md/plugins/file-recovery): benchmark understandable local recovery.
- [Obsidian Help](https://help.obsidian.md/): confirm current behavior for daily notes, templates, search, properties, graph, and Bases before specifying parity.

External research was incomplete: the search provider returned no usable results, and direct page fetches did not expose usable documentation passages. These links are references to verify, not passage-level evidence for a current-release feature audit. Do not invent differences or claim Obsidian parity from this plan.

| Workflow               | What to learn from Obsidian                                          | Write Me decision                                                                       |
| ---------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Connected notes        | Incoming references, readable link context, and reliable navigation. | Prioritize consistent links and backlinks. Keep graph exploration optional.             |
| Finding                | Distinguish quick switching, commands, and content search.           | Improve the existing entry points before adding a query language or search engine.      |
| Workspace control      | Let users arrange information around the current task.               | Start with existing pane controls; consider saved arrangements only after task testing. |
| Daily writing          | Make repeat capture easy to reach and predictable.                   | Reuse existing daily quick notes and templates.                                         |
| Ownership and recovery | Understandable local files and recoverable edits.                    | Validate import, Markdown fidelity, and history; make limits visible.                   |

## 4. Design specification

### Preserve the workbench

- **Left rail:** workspace destinations. Keep existing capabilities reachable; do not delete tools to create a cleaner screenshot.
- **Left panel:** the active activity, such as explorer or search. Use labels and useful empty states, not an expanded permanent menu of every feature.
- **Center:** tabs, note title, writing surface, and compact contextual actions. Writing remains the strongest visual element.
- **Right panel:** note context: outline, outgoing links, incoming links, properties, and tags. Keep AI actions distinct from note metadata.
- **Terminal and AI:** remain available through existing routes/tabs. Do not open them automatically during ordinary writing.

### Responsive and accessible behavior

- Wide screens: the context column is non-modal. Users can move between it and the editor with keyboard and pointer.
- Narrow screens: explorer and context behave as temporary drawers. Only one drawer is open; opening and closing restore sensible focus.
- Reuse the current 959px layout boundary initially. Change it only if screenshot and task evidence shows that the writing area becomes too narrow.
- Test 375, 768, 960, 1280, and 1440px, plus 200% zoom. Avoid horizontal page overflow; code blocks may scroll independently.
- Preserve the current combined header/tabs approach unless tests show a need for another row. Do not add permanent toolbar bands for every new capability.
- Follow existing tokens and `@g4rcez/components`; no raw Tailwind palette colors, replacement icon library, or new font dependency.
- Follow `DESIGN.md` typography: editor body 16–18px with 1.65–1.8 line height; UI 13–14px; titles 30–36px. Treat these as design targets, not evidence of current rendering.
- Meet WCAG AA and preserve any stricter product contrast targets. Include visible focus, non-color state signals, readable disabled states, and reduced-motion support.

A proposed “focus writing” preset should close secondary panes without closing tabs or changing content. First inventory existing focus/zen controls; improve them if present rather than adding another mode.

## 5. Ordered implementation phases

Effort: S = one bounded component/workflow; M = several connected modules; L = wider persistence or compatibility work. Estimates are relative, not delivery promises.

### Phase 1 — Make context behave correctly at each screen size

**Priority:** P1 · **Effort:** S–M · **Risk:** LOW–MED · **Confidence:** high in the source mismatch; runtime impact needs verification.

**Targets:**

- `packages/editor/src/app/components/context-pane.tsx`
- `packages/editor/src/app/layouts/main.layout.tsx`
- `packages/editor/src/app/styles/writeme.css`
- Create `packages/editor/src/app/components/context-pane.test.tsx`
- Create `tests/e2e/editor-layout.spec.ts`

**Steps:**

1. Add a regression showing that desktop context does not have modal semantics or trap keyboard users away from the editor.
2. Separate desktop inspector behavior from narrow-screen drawer behavior. Reuse the design system's supported dialog/focus handling where appropriate; do not build another generic overlay framework.
3. Preserve drawer Escape, focus restoration, route cleanup, reduced motion, and explorer/context mutual exclusion.
4. Capture genuine editor screenshots at the specified widths. Check long titles, empty notes, long notes, open context, collapsed sidebar, and terminal tabs.

**Gate:** `npm run test -- packages/editor/src/app/components/context-pane.test.tsx` → all focused tests pass. After approval for E2E execution, `npm run test:e2e -- tests/e2e/editor-layout.spec.ts` → keyboard traversal, drawer exclusion, focus return, and viewport assertions pass.

**Done:** desktop writing remains reachable with context open; mobile drawers contain focus only while modal; no accidental content edits or route changes.

### Phase 2 — Make links consistent, then add backlinks

**Priority:** P1 for alias/subpath consistency; P2 for backlinks · **Effort:** M · **Risk:** MED · **Confidence:** high for parsing inconsistency; incoming-link coverage remains unverified.

**Targets:** `context-pane.tsx`, `note.page.tsx`, `lib/obsidian-links.ts`; create `packages/editor/src/lib/note-links.ts` and `packages/editor/src/lib/note-links.test.ts`; create `tests/e2e/note-links.spec.ts`.

1. Inventory existing link resolution and incoming-reference consumers before introducing new code. If a shared resolver exists, use it instead of creating `note-links.ts`.
2. Reuse `parseObsidianLink` for aliases and subpaths. Share note-reference resolution between the two existing outgoing-link surfaces; retain mention-ID and `app://note/` support.
3. Define duplicate-title and path resolution explicitly. Do not choose an arbitrary note or change the stored link format. Unresolved/ambiguous references must remain distinguishable from resolved references.
4. Add an **Incoming links** section with source-note title and a short plain-text context excerpt. Inspect existing backlinks first: if already implemented elsewhere, surface/reuse them.
5. Handle rename, deletion, trash, self-links, duplicate links, and note switching. Do not count media attachments as note backlinks.
6. Start from existing loaded data. If complete results require wider loading or an index, measure that path and obtain approval for any schema or persistence change rather than silently scanning the full library on each keystroke.

**Gate:** `npm run test -- packages/editor/src/lib/note-links.test.ts` → bare links, aliases, headings, blocks, mention IDs, duplicates, ambiguous titles, and attachments pass. Approved `npm run test:e2e -- tests/e2e/note-links.spec.ts` → identical outgoing resolution and correct incoming navigation after edits/rename/trash.

**Done:** users can answer both “What does this note link to?” and “What links here?” without inconsistent destinations.

### Phase 3 — Clarify finding before extending search

**Priority:** P2 · **Effort:** M · **Risk:** MED · **Confidence:** high in entry-point labeling; broader search coverage is not yet verified.

**Starting targets:** `main.layout.tsx`, `commander.tsx`; create `tests/e2e/note-finding.spec.ts`. Identify existing content-search owners and tests before approving further paths.

1. Trace all current note, file, and command search entry points. Record title/content coverage, browser/desktop differences, scope, ordering, cancellation, and empty/error states.
2. If the header remains a title-based quick switcher, label it **Open note** or **Quick switcher**. Use **Search notes** only for a content-search workflow. Preserve platform-correct shortcut hints.
3. Keep fast note/tab switching and command execution. Provide a clear path from the same entry point to existing content search rather than duplicating it.
4. Improve results with note title, a relevant snippet, location/scope, and keyboard navigation. Prioritize visible filters for tag, type, and location where existing search supports them.
5. Add saved searches only if existing Views or query tools cannot already meet the need. Do not add another query parser or persistence model without a separate decision.
6. Measure first-result time on representative local fixtures before proposing indexing changes. Record the baseline and library size; do not claim a performance improvement without equivalent before/after checks.

**Gate:** approved `npm run test:e2e -- tests/e2e/note-finding.spec.ts` → a phrase found only in note content is discoverable through the content-search path, scope is clear, keyboard navigation works, and rapid query changes do not show stale results. Run focused tests for the discovered search owner as part of its approved subplan.

**Done:** users understand whether they are opening a note, running a command, or searching content. Broader search implementation stops until owners and tests are identified.

### Phase 4 — Improve writing trust and recovery

**Priority:** P2 · **Effort:** M · **Risk:** MED · **Confidence:** high that history exists; save-state and Markdown-fidelity gaps need further tracing.

**Starting targets:** `note-history-dialog.tsx`, `obsidian-importer.tsx`; create `tests/e2e/note-recovery.spec.ts`. Persistence and serializer edits require a separate bounded scope.

1. Trace current save/error state and existing recovery tests. Improve missing feedback only after confirming what already exists: **Saving**, **Saved locally**, and an actionable error must describe actual persistence, not elapsed time.
2. Add a current-versus-snapshot comparison to existing history. Keep read-only preview and confirmation. Prefer a simple side-by-side comparison if there is no suitable existing diff utility; do not add a package for this phase.
3. Verify that restore retains the previous current version and failures leave readable content intact. Preserve current history storage and retention.
4. Build a small fixture vault for Markdown round-trip checks: headings, aliases/subpaths, frontmatter, tasks, tables, math, code blocks, and relative attachments. Treat unsupported constructs explicitly; do not silently drop them.
5. Keep import source read-only, destination overwrite protection, relative-path validation, and partial-failure summaries. Inventory export before proposing another exporter.

**Gate:** approved `npm run test:e2e -- tests/e2e/note-recovery.spec.ts` → comparison is read-only, confirmed restore is recoverable, and simulated failure does not discard current text. Compatibility tests must compare fixture source/destination bytes or declared normalized semantics, not screenshots alone.

**Done:** recovery is understandable and import limits are documented. A compatibility defect needing serializer, file-format, or storage changes becomes a separate approved plan.

### Phase 5 — Connect daily capture and templates to the main workspace

**Priority:** P2 · **Effort:** M · **Risk:** MED · **Confidence:** high in existing daily/template infrastructure; command/calendar integration needs inventory.

**Starting targets:** `floating-note.page.tsx`, `use-templates.ts`, `commander.tsx`; create `tests/e2e/daily-capture.spec.ts`. Identify calendar owners before editing that surface.

1. Inventory current Today/quick-note commands and calendar navigation. Improve discoverability rather than adding duplicate commands.
2. Reuse the existing get-or-create daily-note behavior from normal workspace navigation. Extract it only if the main and floating workflows both need the same implementation.
3. Let users select an existing template for a new daily note. Never apply a template automatically over existing content. Reuse template settings and storage.
4. Verify local-day boundaries, repeated opening, concurrent requests, desktop files, and browser repositories. An unreadable note is an error, not permission to replace it.
5. Use the repository's date helpers and date-formatting skill for displayed dates; do not introduce component-local locale formatting.

**Gate:** approved `npm run test:e2e -- tests/e2e/daily-capture.spec.ts` → repeated Today navigation opens the same note, existing text is preserved, templates apply only at creation, and date-boundary fixtures behave as specified. Add and run focused unit tests for any extracted helper.

**Done:** daily writing is easy to reach without a second daily-note store or a desktop/browser split in meaning.

## 6. New capabilities worth considering later

These are discovery candidates, not approved implementation work or confirmed repository-wide absences.

| Candidate                               | Benefit                                                  | Priority / effort / risk | Approval gate                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Incoming links with contextual excerpts | Connect ideas without opening a graph.                   | P2 / M / MED             | Phase 2 inventory confirms no reusable implementation.                                                                          |
| Saved writing/research arrangements     | Switch between a calm editor and a multi-pane task.      | P3 / M / MED             | Task study shows that current pane controls are insufficient; inspect existing persistence.                                     |
| Editable typed properties               | Make metadata useful for retrieval and structured views. | P3 / M–L / HIGH          | Inventory existing property/frontmatter editors and Views; approve round-trip and schema rules.                                 |
| Local note graph                        | Explore nearby relationships.                            | P3 / L / MED             | Backlinks are reliable and users can name a graph task that lists cannot solve. Keep global graph out of the default workspace. |
| Unlinked mentions                       | Suggest possible connections.                            | P3 / M / MED             | Measure relevance and cost; keep suggestions separate from real links and require user action.                                  |

**Defer:** a general plugin platform, marketplace, collaboration/sync, a replacement database, new query language, another AI chat surface, and a global graph as the home page. These introduce substantial maintenance or trust costs and are not necessary to improve the primary workflow.

## 7. Validation and user evidence

### Commands

Use npm. Do not install dependencies or run full suites/builds as part of planning.

| Purpose                                         | Command                                                              | Expected result                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Baseline                                        | `git rev-parse --short HEAD`                                         | Record the actual implementation baseline; reconcile drift from `7487a26`. |
| Typecheck after changes                         | `npm run typecheck`                                                  | Exit 0; no new TypeScript errors.                                          |
| Focused unit tests                              | `npm run test -- <approved test file>`                               | All tests in the named file pass.                                          |
| Focused feature tests, after execution approval | `npm run test:e2e -- <approved spec file>`                           | The phase's behavioral assertions pass.                                    |
| Formatting                                      | `./node_modules/.bin/oxfmt --check <changed supported source files>` | Exit 0.                                                                    |
| Whitespace                                      | `git diff --check`                                                   | Exit 0.                                                                    |
| Scope                                           | `git diff --name-only` and `git status --short`                      | Only the phase's approved paths changed, including new tests.              |

New test paths above are proposed files; do not run them before creating their tests. Use `tests/e2e/fixtures.ts` and existing navigation tests as patterns after reading them. Run active LSP diagnostics for changed paths and session diagnostics for other dispatch runners. Empty cached diagnostics are not proof of a clean file.

### Screenshot review

Browser E2E screenshots use anonymized fixture notes and are retained in [`evidence/016/`](evidence/016/):

- Empty note with context open: [375px](evidence/016/empty-note-context-375.png), [768px](evidence/016/empty-note-context-768.png), [960px](evidence/016/empty-note-context-960.png), [1280px](evidence/016/empty-note-context-1280.png), [1440px](evidence/016/empty-note-context-1440.png).
- Long note with the sidebar collapsed and context open: [375px](evidence/016/long-note-context-375.png), [640px](evidence/016/long-note-context-640.png), [768px](evidence/016/long-note-context-768.png), [960px](evidence/016/long-note-context-960.png), [1280px](evidence/016/long-note-context-1280.png), [1440px](evidence/016/long-note-context-1440.png).
- Terminal tab: [375px](evidence/016/terminal-tab-375.png), [1280px](evidence/016/terminal-tab-1280.png).
- Actual 200% browser zoom with a long note and open context drawer: [screenshot](evidence/016/actual-zoom-200-context.png).

The 640px capture checks a compact CSS viewport. The actual zoom capture was taken at a 1280×900 browser viewport with browser zoom set to 200% (`devicePixelRatio: 2`, CSS viewport 640×450, visual viewport scale 1). The document width was 640 CSS pixels and the drawer fit within the viewport; no page errors occurred. The long note title truncates in the tab and context header, but the page does not overflow. This is visual evidence, not a user-tested defect; keep it for the task study rather than changing title behavior based on screenshots alone.

### Task review

After Phase 1, run a small formative study with 3–5 intended users. This provides directional evidence, not statistical proof:

1. Create a note, add headings, and keep writing with the outline open.
2. Find a note using a phrase in its body.
3. Follow a link and find the notes that refer back to it.
4. Open today's note twice without losing content.
5. Compare and restore a previous version.

Record completion, wrong turns, keyboard accessibility, and whether users can explain save/search state. Benchmark the current app first and repeat the same tasks after the relevant phase. Use anonymized fixture notes, not production notes or credentials. Do not declare the layout “great” from screenshots alone.

## 8. Scope, stop conditions, and maintenance

### Boundaries

- During this planning task, only `plans/016-improve-writing-finding-linking.md` and its index entry may change.
- During implementation, each phase permits only its named targets and approved tests. “Starting targets” require a further scoped decision before modifying additional owners.
- Preserve routes, shortcuts, note identity, Markdown/file formats, local storage, desktop/browser compatibility, and terminal behavior unless the owner explicitly approves a change.
- Do not change authentication, credentials, encryption, proxy boundaries, installed app data, dependencies, or lockfiles.
- Do not replace landing-page design or redesign unrelated settings.
- Do not commit, stage, push, create a PR, or create a worktree unless requested.

### Stop and report if

- Source drift invalidates the evidence or a proposed feature already exists in another usable path.
- Correct links require guessing between duplicate titles or silently rewriting stored references.
- Complete backlinks/search require an unapproved index, schema, wider data loading, or file-format change.
- A drawer change breaks editor selection, IME input, keyboard navigation, route transitions, or focus restoration.
- Recovery or daily capture requires overwriting unreadable content or modifying production data.
- A verification step fails twice after a reasonable fix attempt, or the required tool/runtime is unavailable.
- An implementation needs out-of-scope files or new dependencies. Do not improvise a broader refactor.

### Maintenance

- Keep one note-link resolution policy across the editor, context, footer, import, and future backlinks. Extend tests when supported syntax changes.
- Keep responsive semantics aligned with the CSS breakpoint. Test resizing while drawers are open.
- Treat incoming references as derived data with explicit freshness and cancellation ownership if loading becomes asynchronous.
- Review both browser and desktop workflows, and preserve source-vault and history safety guarantees.
- New property, graph, or workspace-preset work needs its own bounded plan rather than expanding an earlier phase.

## Done criteria

- [x] Each implemented phase has focused unit/Playwright results and changed-path diagnostics.
- [x] Genuine editor screenshots exist for the responsive matrix; no placeholder is used as visual evidence.
- [x] Desktop context is non-modal; narrow drawers are keyboard-safe.
- [x] Existing outgoing-link surfaces agree on supported link targets.
- [x] Finding, recovery, and daily-capture acceptance cases pass for phases implemented.
- [x] No unapproved schema, format, dependency, security, or production-data changes occurred.
- [ ] Task-study findings distinguish measured outcomes from design assumptions.
- [x] `plans/README.md` records the real status; deferred candidates remain deferred.

**Checks completed for this implementation:** `npm run typecheck`; 8 focused Vitest files (42 tests); all 5 Plan 016 Playwright specs (7 tests), including drawer focus containment/restoration and mutual exclusion; active LSP diagnostics for 31 relevant paths plus final changed-path checks; targeted Oxfmt; `git diff --check`; and an actual 200% browser-zoom review with screenshot evidence. The full `npm run format:check` remains blocked by Oxfmt failing to resolve `@excalidraw/excalidraw/index.css` while checking `index.html`. The 3–5-person user task study and a screen-reader session remain outstanding.
