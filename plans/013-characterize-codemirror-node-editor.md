# Plan 013: Characterize the CodeMirror node editor before refactoring

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 0f1551f..HEAD -- src/app/elements/code-block/codemirror-node-code-editor.tsx src/app/elements/code-block/codemirror-node-code-editor.test.tsx src/test/setup.ts vitest.config.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `0f1551f`, 2026-06-15

## Why this matters

`CodeMirrorNodeCodeEditor` is a custom bridge between React, CodeMirror, and the Tiptap node view. It owns high-risk editor behavior: synchronizing external node content, trapping DOM events so ProseMirror does not steal input, leaving the code block with ArrowUp/ArrowDown, and asynchronously loading language extensions. There are no tests for this component today, so even small cleanup in this file can regress core writing behavior without warning.

This plan adds characterization tests only. It should not refactor production code; it creates the safety net needed before Plan 014 removes the redundant regex highlighter.

## Current state

Relevant files:

- `src/app/elements/code-block/codemirror-node-code-editor.tsx` — React wrapper around CodeMirror for editable Tiptap code blocks.
- `src/app/elements/code-block/code-block-rendered.tsx` — parent node view that passes `value`, `language`, `isDark`, `onChange`, `onExitUp`, and `onExitDown` into the editor.
- `src/test/setup.ts` — global Vitest setup currently only installs `@testing-library/jest-dom` and mocks `scrollIntoView`.
- `vitest.config.ts` — tests run in `jsdom` with `setupFiles: "./src/test/setup.ts"`.

Current production excerpts to preserve:

```tsx
// src/app/elements/code-block/codemirror-node-code-editor.tsx:592-611
const containerRef = useRef<HTMLDivElement>(null);
const viewRef = useRef<EditorView | null>(null);
const onChangeRef = useRef(onChange);
const onExitDownRef = useRef(onExitDown);
const onExitUpRef = useRef(onExitUp);
const arrowDownAtLastLineRef = useRef(false);
const arrowUpAtFirstLineRef = useRef(false);
const valueRef = useRef(value);
const languageCompartmentRef = useRef(new Compartment());

useEffect(() => {
  onChangeRef.current = onChange;
}, [onChange]);

useEffect(() => {
  onExitDownRef.current = onExitDown;
}, [onExitDown]);
```

```tsx
// src/app/elements/code-block/codemirror-node-code-editor.tsx:622-656
useEffect(() => {
  if (!containerRef.current) return;
  const theme = isDark ? catppuccinMocha() : catppuccinLatte();
  const view = new EditorView({
    state: EditorState.create({
      doc: valueRef.current,
      extensions: [
        minimalSetup,
        languageCompartmentRef.current.of([]),
        createCodeMirrorHighlightExtension(language),
        autocompletion({
          override: [createKeywordCompletionSource(language)],
        }),
        keymap.of([
          {
            key: "ArrowUp",
            run: (view) => {
              arrowDownAtLastLineRef.current = false;
              if (completionStatus(view.state) === "active") {
                arrowUpAtFirstLineRef.current = false;
                return false;
              }
```

```tsx
// src/app/elements/code-block/codemirror-node-code-editor.tsx:736-748
useEffect(() => {
  const view = viewRef.current;
  if (!view) return;
  const currentValue = view.state.doc.toString();
  if (currentValue === valueRef.current) return;
  view.dispatch({
    changes: { from: 0, to: currentValue.length, insert: valueRef.current },
  });
}, [value]);

return (
  <div
```

Existing test style to match:

- Code-block tests live next to implementation files, e.g. `src/app/elements/code-block/mermaid.test.tsx`.
- Tests use Vitest + React Testing Library imports such as `render`, `screen`, `waitFor`, `describe`, `expect`, `it`, `vi`.
- Async behavior is tested with deferred promises and `waitFor` where needed.

Repo conventions to follow:

- Use `npm`, not `pnpm` or `yarn`.
- TypeScript is strict (`noImplicitAny`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`).
- React components are functional TSX components.
- Prefer type-safe mocks; if an unavoidable test cast is needed, keep it local to the test and avoid production `any`.

## Commands you will need

| Purpose         | Command                                                                            | Expected on success                    |
| --------------- | ---------------------------------------------------------------------------------- | -------------------------------------- |
| Targeted tests  | `npm run test -- src/app/elements/code-block/codemirror-node-code-editor.test.tsx` | exit 0; all tests in the new file pass |
| Typecheck       | `npm run typecheck`                                                                | exit 0, no TypeScript errors           |
| Full unit suite | `npm run test`                                                                     | exit 0; existing tests still pass      |

## Scope

**In scope**:

- `src/app/elements/code-block/codemirror-node-code-editor.test.tsx` (create)
- `src/test/setup.ts` only if jsdom needs a missing browser API shim for CodeMirror tests, such as `ResizeObserver` or `requestAnimationFrame`

**Out of scope**:

- Do not change `src/app/elements/code-block/codemirror-node-code-editor.tsx` in this plan.
- Do not change `src/app/elements/code-block/code-block-rendered.tsx`.
- Do not change CodeMirror dependencies, Vite config, package scripts, or lockfiles.
- Do not add snapshot tests; these behaviors are interaction/state contracts, not visual snapshots.

## Git workflow

- Branch suggestion: `advisor/013-characterize-codemirror-node-editor`.
- Commit style in recent history is conventional commits, e.g. `refactor: migrate state management from use-typed-reducer to Zustand`; use a message like `test: characterize codemirror node editor` if committing is requested.
- Do not push or open a PR unless the operator explicitly instructs you.

## Steps

### Step 1: Create a render helper for the editor

Create `src/app/elements/code-block/codemirror-node-code-editor.test.tsx`.

Use React Testing Library to render `CodeMirrorNodeCodeEditor` with default props:

- `language="javascript"`
- `value="const a = 1;"`
- `isDark={false}`
- `onChange`, `onExitDown`, `onExitUp` as `vi.fn()` callbacks

The helper should return the rendered container and callbacks. Locate the editor root with `[data-code-mirror-editor="true"]`, and locate the editable CodeMirror content with `.cm-content[contenteditable="true"]` or an equivalent stable CodeMirror selector.

If CodeMirror requires a missing jsdom API, add the smallest test-environment shim in `src/test/setup.ts`. Keep it generic and safe for the whole suite.

**Verify**: `npm run test -- src/app/elements/code-block/codemirror-node-code-editor.test.tsx` → the new file runs; failures should be only for assertions not written yet, not environment crashes.

### Step 2: Test initial render and external value synchronization

Add tests that prove:

1. The initial `value` appears in CodeMirror's DOM/text content.
2. Rerendering with a different `value` updates the CodeMirror document.
3. Rerendering with the same `value` does not call `onChange` spuriously.

Implementation hint: prefer user-visible DOM text assertions when reliable. If CodeMirror's DOM splits text across spans, assert against `container.textContent` with whitespace-normalized matching.

**Verify**: `npm run test -- src/app/elements/code-block/codemirror-node-code-editor.test.tsx` → new synchronization tests pass.

### Step 3: Test user edits call `onChange`

Add an interaction test that focuses the CodeMirror content and simulates a small user edit. Use `@testing-library/user-event` if it works with CodeMirror's contenteditable surface; otherwise dispatch the minimal DOM/input events needed for CodeMirror to accept text in jsdom.

Assert that `onChange` is called with the updated document text.

If CodeMirror cannot be driven realistically in jsdom after a reasonable attempt, STOP and report. Do not replace this with a brittle implementation-detail test that dispatches directly into private `EditorView` internals.

**Verify**: `npm run test -- src/app/elements/code-block/codemirror-node-code-editor.test.tsx` → edit test passes.

### Step 4: Test ArrowUp/ArrowDown escape behavior

Add tests for the documented navigation behavior:

- From a single-line document, the first `ArrowUp` keypress should not call `onExitUp`; the second consecutive `ArrowUp` should call `onExitUp` once.
- From a single-line document, the first `ArrowDown` keypress should not call `onExitDown`; the second consecutive `ArrowDown` should call `onExitDown` once.
- Moving away from the boundary or changing the document should reset the two-press latch if this can be simulated reliably.

Use the public keyboard behavior through the contenteditable element. Do not call the `keymap` handlers directly.

**Verify**: `npm run test -- src/app/elements/code-block/codemirror-node-code-editor.test.tsx` → arrow escape tests pass.

### Step 5: Test event isolation from ProseMirror parents

Add a test that attaches capturing/bubbling listeners to a wrapper around the editor and verifies CodeMirror stops propagation for at least `keydown` and `paste` events. The production component intentionally does this via `EditorView.domEventHandlers` so the parent Tiptap editor does not handle code-block typing as outer editor input.

Assert only propagation behavior; do not assert private CodeMirror implementation details.

**Verify**: `npm run test -- src/app/elements/code-block/codemirror-node-code-editor.test.tsx` → event isolation tests pass.

### Step 6: Run final validation

Run the targeted test, typecheck, and full unit suite.

**Verify**:

- `npm run test -- src/app/elements/code-block/codemirror-node-code-editor.test.tsx` → exit 0.
- `npm run typecheck` → exit 0.
- `npm run test` → exit 0.

## Test plan

New tests in `src/app/elements/code-block/codemirror-node-code-editor.test.tsx` should cover:

- Initial document rendering.
- External `value` prop synchronization.
- User edit propagation through `onChange`.
- Two-press ArrowUp and ArrowDown escape callbacks.
- DOM event propagation isolation for keydown/paste.

Use `src/app/elements/code-block/mermaid.test.tsx` as the closest async React Testing Library style reference.

## Done criteria

All must hold:

- [ ] `src/app/elements/code-block/codemirror-node-code-editor.test.tsx` exists and contains meaningful behavior tests, not snapshots.
- [ ] Production source files are unchanged except optional generic jsdom shims in `src/test/setup.ts`.
- [ ] `npm run test -- src/app/elements/code-block/codemirror-node-code-editor.test.tsx` exits 0.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm run test` exits 0.
- [ ] No files outside the in-scope list are modified.
- [ ] `plans/README.md` row 013 is updated if this plan is executed.

## STOP conditions

Stop and report back if:

- The live editor code no longer matches the Current state excerpts.
- CodeMirror cannot be interacted with through public DOM/user-event behavior in jsdom after a reasonable attempt.
- Passing tests requires changing production editor behavior.
- Passing tests requires adding new dependencies or changing package scripts.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

These tests intentionally lock down behavior before refactoring. Reviewers should scrutinize whether tests exercise public user/editor behavior rather than CodeMirror internals. If later CodeMirror upgrades change DOM structure, update selectors in the test helper first; do not weaken the behavioral assertions.
