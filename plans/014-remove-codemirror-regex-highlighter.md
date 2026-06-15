# Plan 014: Remove the redundant CodeMirror regex highlighter

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 0f1551f..HEAD -- src/app/elements/code-block/codemirror-node-code-editor.tsx src/app/elements/code-block/codemirror-node-code-editor.test.tsx src/app/elements/code-block/editor-themes.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: `plans/013-characterize-codemirror-node-editor.md`
- **Category**: tech-debt
- **Planned at**: commit `0f1551f`, 2026-06-15

## Why this matters

`CodeMirrorNodeCodeEditor` currently has two syntax-highlighting systems: native CodeMirror language packages plus a hand-written regex `ViewPlugin`. The regex highlighter duplicates keywords, comments, strings, and numbers for many languages, but it is necessarily incomplete and can drift from the actual parser. It also adds custom `wm-cm-*` color classes with hard-coded palette hex values inside a multi-theme editor, violating the project's token/theme guidance.

Removing the regex highlighter makes the component smaller, lets `editor-themes.ts` own CodeMirror syntax colors, and reduces the chance of conflicting nested decorations. This plan depends on Plan 013 so behavior around editing, value sync, and arrow escape is protected before the cleanup.

## Current state

Relevant files:

- `src/app/elements/code-block/codemirror-node-code-editor.tsx` — contains both the editor wrapper and a custom regex highlighter.
- `src/app/elements/code-block/editor-themes.ts` — already defines CodeMirror `HighlightStyle` with Catppuccin colors and `syntaxHighlighting(highlightStyle)`.
- `src/app/elements/code-block/codemirror-node-code-editor.test.tsx` — should exist after Plan 013 and protect editor behavior during this refactor.

Current regex highlighter excerpts:

```tsx
// src/app/elements/code-block/codemirror-node-code-editor.tsx:365-383
type HighlightKind = "comment" | "function" | "keyword" | "number" | "string";

type HighlightRange = {
  from: number;
  to: number;
  kind: HighlightKind;
};

const CODE_MIRROR_HIGHLIGHT_DECORATIONS: Record<
  HighlightKind,
  ReturnType<typeof CmDecoration.mark>
> = {
  number: CmDecoration.mark({ class: "wm-cm-number" }),
  string: CmDecoration.mark({ class: "wm-cm-string" }),
  comment: CmDecoration.mark({ class: "wm-cm-comment" }),
  keyword: CmDecoration.mark({ class: "wm-cm-keyword" }),
  function: CmDecoration.mark({ class: "wm-cm-function" }),
};
```

```tsx
// src/app/elements/code-block/codemirror-node-code-editor.tsx:396-531
function findPatternRanges(
  text: string,
  pattern: RegExp,
  offset: number,
  kind: HighlightKind,
): HighlightRange[] {
  return Array.from(text.matchAll(pattern), (match) => ({
    from: offset + match.index,
    to: offset + match.index + match[0].length,
    kind,
  }));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ... getKeywordPattern, getCommentPattern, getHighlightRanges ...

function createCodeMirrorHighlightExtension(language: string): Extension {
  const completionLanguage = getCompletionLanguage(language);
  if (!completionLanguage) return [];

  return ViewPlugin.fromClass(
    class {
      decorations;
      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations(update.view);
        }
      }
      buildDecorations(view: EditorView) {
        const decorations = [];
        // scans visibleRanges with regexes and emits wm-cm-* decorations
        return CmDecoration.set(decorations, true);
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    },
  );
}
```

Current theme hard-codes custom regex-highlighter colors:

```tsx
// src/app/elements/code-block/codemirror-node-code-editor.tsx:555-570
".wm-cm-function": {
  color: "#89b4fa",
  fontWeight: "600",
},
".wm-cm-keyword": {
  color: "#cba6f7",
  fontWeight: "600",
},
".wm-cm-number": {
  color: "#fab387",
},
".wm-cm-string": {
  color: "#a6e3a1",
},
```

The editor already loads native CodeMirror language support and theme highlighting:

```tsx
// src/app/elements/code-block/codemirror-node-code-editor.tsx:263-331
async function toCodeMirrorLanguage(language: string): Promise<Extension[]> {
  switch (getCompletionLanguage(language)) {
    case "c":
    case "cpp": {
      const { cpp } = await import("@codemirror/lang-cpp");
      return [cpp()];
    }
    // ... css, html, java, json, markdown, php, python, rust, sql, js/ts, xml, yaml ...
    default:
      return [];
  }
}
```

```tsx
// src/app/elements/code-block/editor-themes.ts:87-130
const highlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: colors.mauve.hex },
  {
    tag: [t.name, t.definition(t.name), t.deleted, t.character, t.macroName],
    color: colors.text.hex,
  },
  {
    tag: [
      t.function(t.variableName),
      t.function(t.propertyName),
      t.propertyName,
      t.labelName,
    ],
    color: colors.blue.hex,
  },
  { tag: [t.bool, t.number], color: colors.peach.hex },
  {
    tag: [t.processingInstruction, t.string, t.inserted],
    color: colors.green.hex,
  },
]);

return [theme, syntaxHighlighting(highlightStyle)];
```

Repo/design constraints to honor:

- `DESIGN.md` says: "Don't use any hardcoded color that is not a design token reference or CSS custom property. The multi-theme system only works if every color value is token-sourced."
- Existing CodeMirror theme colors in `editor-themes.ts` are intentionally derived from Catppuccin flavors; do not replace that file's palette system in this plan.
- Use `npm`, not `pnpm` or `yarn`.
- TypeScript is strict and `noUnusedLocals` is enabled, so remove imports and helpers made unused.

## Commands you will need

| Purpose           | Command                                                                                                                                               | Expected on success                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Targeted tests    | `npm run test -- src/app/elements/code-block/codemirror-node-code-editor.test.tsx`                                                                    | exit 0; Plan 013 behavior tests still pass |
| Typecheck         | `npm run typecheck`                                                                                                                                   | exit 0, no TypeScript errors               |
| Full unit suite   | `npm run test`                                                                                                                                        | exit 0; existing tests still pass          |
| Static grep check | `grep -R "wm-cm-\|createCodeMirrorHighlightExtension\|CODE_MIRROR_HIGHLIGHT_DECORATIONS" src/app/elements/code-block/codemirror-node-code-editor.tsx` | exit 1; no matches                         |

## Scope

**In scope**:

- `src/app/elements/code-block/codemirror-node-code-editor.tsx`
- `src/app/elements/code-block/codemirror-node-code-editor.test.tsx` only to adjust or add assertions that protect the new no-regex-highlighter behavior

**Out of scope**:

- Do not edit `src/app/elements/code-block/editor-themes.ts` unless removing now-dead references becomes necessary; native theme behavior should remain unchanged.
- Do not change CodeMirror package versions or add dependencies.
- Do not redesign the editor visuals beyond removing `wm-cm-*` regex decoration classes.
- Do not remove keyword completion; `LANGUAGE_COMPLETIONS` and `createKeywordCompletionSource` should remain unless a test proves they are dead.
- Do not change `CodeBlockRenderer`, Tiptap schema, markdown serialization, or execution output behavior.

## Git workflow

- Branch suggestion: `advisor/014-remove-codemirror-regex-highlighter`.
- Commit style in recent history is conventional commits, e.g. `refactor: migrate state management from use-typed-reducer to Zustand`; use a message like `refactor: rely on codemirror syntax highlighting` if committing is requested.
- Do not push or open a PR unless the operator explicitly instructs you.

## Steps

### Step 1: Confirm Plan 013 safety net exists and passes

Before editing production code, confirm `src/app/elements/code-block/codemirror-node-code-editor.test.tsx` exists and includes behavior tests for render/sync/edit/arrow escape/event isolation.

**Verify**: `npm run test -- src/app/elements/code-block/codemirror-node-code-editor.test.tsx` → exit 0.

### Step 2: Remove the regex highlighter extension from the editor setup

In `src/app/elements/code-block/codemirror-node-code-editor.tsx`, remove this extension from the `extensions` array:

```tsx
createCodeMirrorHighlightExtension(language),
```

Do not remove `languageCompartmentRef.current.of([])` or the async `toCodeMirrorLanguage(language)` reconfiguration; that is the native language support path.

**Verify**: `npm run test -- src/app/elements/code-block/codemirror-node-code-editor.test.tsx` → exit 0.

### Step 3: Delete the regex highlighter implementation and unused imports

Delete the now-unused highlighter-only code from `src/app/elements/code-block/codemirror-node-code-editor.tsx`:

- `HighlightKind`
- `HighlightRange`
- `CODE_MIRROR_HIGHLIGHT_DECORATIONS`
- `findPatternRanges`
- `escapeRegex`
- `getKeywordPattern`
- `getCommentPattern`
- `getHighlightRanges`
- `createCodeMirrorHighlightExtension`

Then remove imports made unused by that deletion:

- `Decoration as CmDecoration`
- `ViewPlugin`
- `type ViewUpdate`

Keep `keymap` from `@codemirror/view`; it is still used.

**Verify**:

- `npm run typecheck` → exit 0, with no unused import/local errors.
- `grep -R "createCodeMirrorHighlightExtension\|CODE_MIRROR_HIGHLIGHT_DECORATIONS" src/app/elements/code-block/codemirror-node-code-editor.tsx` → exit 1, no matches.

### Step 4: Remove custom `wm-cm-*` theme rules

In `CODE_MIRROR_EDITOR_THEME`, remove CSS rules that only style deleted regex decorations:

- `.wm-cm-comment`
- `.wm-cm-function`
- `.wm-cm-keyword`
- `.wm-cm-number`
- `.wm-cm-string`

Do not remove general CodeMirror structural styles such as `.cm-content`, `.cm-cursor`, `.cm-gutters`, or `.cm-scroller`.

**Verify**:

- `grep -R "wm-cm-" src/app/elements/code-block/codemirror-node-code-editor.tsx` → exit 1, no matches.
- `npm run typecheck` → exit 0.

### Step 5: Add or adjust a regression assertion

If Plan 013 tests do not already cover this, add a small assertion to `src/app/elements/code-block/codemirror-node-code-editor.test.tsx` that renders a JavaScript editor and confirms custom regex decoration classes are not emitted:

- render with `language="javascript"` and `value={'const answer = 42;'}`
- wait for the editor to mount
- assert `container.querySelector('[class*="wm-cm-"]')` is `null`

This protects against reintroducing the deleted highlighter. Do not assert exact native CodeMirror token classes; those are library internals and may change.

**Verify**: `npm run test -- src/app/elements/code-block/codemirror-node-code-editor.test.tsx` → exit 0.

### Step 6: Run final validation

Run all verification commands.

**Verify**:

- `npm run test -- src/app/elements/code-block/codemirror-node-code-editor.test.tsx` → exit 0.
- `npm run typecheck` → exit 0.
- `npm run test` → exit 0.
- `grep -R "wm-cm-\|createCodeMirrorHighlightExtension\|CODE_MIRROR_HIGHLIGHT_DECORATIONS" src/app/elements/code-block/codemirror-node-code-editor.tsx` → exit 1, no matches.

## Test plan

This plan relies on the tests from Plan 013 and adds one regression assertion that no `wm-cm-*` classes are emitted. It should not add visual snapshots or assert exact CodeMirror native token class names.

## Done criteria

All must hold:

- [ ] `createCodeMirrorHighlightExtension` and its helper functions are removed from `src/app/elements/code-block/codemirror-node-code-editor.tsx`.
- [ ] `Decoration as CmDecoration`, `ViewPlugin`, and `type ViewUpdate` imports are removed if unused.
- [ ] `CODE_MIRROR_EDITOR_THEME` no longer contains `.wm-cm-*` selectors or hard-coded regex-highlighter hex colors.
- [ ] Keyword completion still works; `createKeywordCompletionSource` remains unless explicitly proven unnecessary and separately planned.
- [ ] `npm run test -- src/app/elements/code-block/codemirror-node-code-editor.test.tsx` exits 0.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm run test` exits 0.
- [ ] No files outside the in-scope list are modified.
- [ ] `plans/README.md` row 014 is updated if this plan is executed.

## STOP conditions

Stop and report back if:

- Plan 013 has not been completed or its tests do not pass.
- The live code no longer matches the Current state excerpts.
- Removing the regex highlighter causes CodeMirror's native language highlighting to disappear for standard languages such as JavaScript after the async language extension loads.
- The cleanup appears to require changing CodeMirror theme architecture or package versions.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

After this cleanup, syntax color ownership should be clear: `editor-themes.ts` owns CodeMirror syntax highlighting, while `codemirror-node-code-editor.tsx` owns editor lifecycle, key handling, completion, and value synchronization. If future work needs better highlighting for `math`, plan that as a focused math language extension or theme change rather than restoring broad regex tokenization across all languages.
