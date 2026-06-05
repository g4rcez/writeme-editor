# Code Context

## Files Retrieved

1. `src/app/commander.tsx` (lines 1-437) - Commander component, command item construction, `CommanderType` filtering, and `CommandPalette` wiring.
2. `src/store/global.store.ts` (lines 1-504) - global UI/store state for commander, tabs, active tab, and tab actions.
3. `src/app/elements/shortcut-items.tsx` (lines 1-267) - shortcut definitions, registration hook, and shortcut-to-command item source.
4. `src/lib/shortcuts.ts` (lines 1-117) - app shortcut registry and `mod` key normalization.
5. `src/app/root-layout.tsx` (lines 1-230) - root mounting point for `Commander` and manual global keydown handlers for tab cycling and app UI.
6. `src/app/components/tabs-bar.tsx` (lines 1-160) - opened tabs UI and note-title lookup pattern.
7. `src/store/repositories/entities/tab.ts` (lines 1-19) - `Tab` entity fields used by opened-tab filtering.
8. `src/app/pages/note.page.tsx` (lines 80-114) - note route behavior that loads notes and ensures tabs exist.
9. `src/app/main.tsx` (lines 80-126) - startup loading of notes/tabs into global store.
10. `src/lib/tab-cycling.ts` (lines 1-40) and `src/lib/tab-cycling.test.ts` (lines 1-82) - existing tab-order helper and test style.
11. `src/app/elements/shortcut-items.test.tsx` (lines 1-48) - existing shortcut hook tests that may need expectations/mocks updated.
12. `node_modules/@g4rcez/components/ai/docs/CommandPalette.md` (lines 20-70) - `CommandPalette` prop/type docs, including default `bind` and command item shapes.

## Key Code

`src/store/global.store.ts` has the only commander mode enum today:

```ts
export enum CommanderType {
  All = "all",
  Notes = "Notes",
}

export type Commander = { enabled: boolean; type: CommanderType };
```

State includes opened tabs and active tab:

```ts
tabs: Tab[];
commander: Commander;
activeTabId: string | null;
```

The dispatcher controls commander mode and resets to `All` when no type is provided:

```ts
commander: (enabled: boolean, type?: CommanderType) => ({
  commander: { enabled, type: type || CommanderType.All },
}),
```

Tab creation/selection uses note IDs as tab IDs. This makes opened-tab commands simple: `tab.id` and `tab.noteId` are usually the same, but use `tab.noteId` for navigation.

```ts
const createTab = (noteId: string): Tab => ({
  noteId,
  id: noteId,
  order: state.tabs.length,
  ...
});
```

`src/app/commander.tsx` builds `noteGroup` from all notes and filters only for `CommanderType.Notes`:

```ts
const noteGroup = useMemo(
  (): CommandItemTypes[] =>
    globalState().notes.map((note: Note): CommandItemTypes => ({
      type: "shortcut",
      title: `Note: ${note.title}`,
      action: (args) => {
        args.setOpen(false);
        navigate(`/note/${note.id}`);
      },
    })),
  [notesSig, navigate],
);

const options = useMemo(() => {
  if (state.commander.type === CommanderType.Notes) {
    return noteGroup;
  }
  ...
}, [...]);
```

At the bottom, commander visibility is controlled by global store:

```tsx
<CommandPalette
  commands={options}
  open={state.commander.enabled}
  onChangeVisibility={dispatch.commander}
/>
```

`src/app/elements/shortcut-items.tsx` is the central shortcut list. Existing Commander shortcut is hidden and not registered by `useShortcuts()`:

```ts
{
  hidden: true,
  bind: "mod+k",
  type: Type.Shortcut,
  description: "Commander",
  action: () => dispatch.commander(true),
}
```

Registration skips hidden shortcuts:

```ts
useEffect(() => {
  commands.forEach((x) => {
    if (x.hidden) return;
    shortcuts.add(x.bind, x.action);
  });
  return () => shortcuts.removeAll();
}, []);
```

`src/lib/shortcuts.ts` normalizes `mod` to a cross-platform control-like key string. With `multiPlatform: true`, both `Ctrl` and `Cmd` generate `control+...`; `shortcuts` is created with `mod = "control"`, so `mod+t` matches Ctrl/Cmd+T.

```ts
if (options.multiPlatform && (e.ctrlKey || e.metaKey)) keys.push(Key.Control);
...
export const shortcuts = shortcutKeys(window, "control");
```

`src/app/components/tabs-bar.tsx` shows the opened-tab title lookup pattern:

```tsx
{
  state.tabs.map((tab: Tab) => {
    const note = state.notes.find((n: Note) => n.id === tab.noteId);
    const title = note?.title || "Untitled";
    return <Link to={tab.noteId ? `/note/${tab.noteId}` : "#"}>...</Link>;
  });
}
```

`CommandPalette` supports flat shortcut items and grouped items. Docs say it has default `bind = "Mod + k"`, which likely explains why the hidden `mod+k` shortcut is not registered by app `useShortcuts()`.

## Architecture

- App startup (`src/app/main.tsx`) loads all notes and persisted tabs from repositories, then calls `globalDispatch.init(...)` to populate `state.notes` and `state.tabs`.
- `RootLayout` mounts `<Commander />` globally, so commander state can be toggled from anywhere.
- `Commander` calls `useShortcuts()` on mount, builds command arrays from store data, then passes them into `@g4rcez/components` `CommandPalette`.
- Existing filtering model is enum-based: `state.commander.type === CommanderType.Notes` returns only note commands; otherwise it returns the full grouped command palette.
- Opened tabs are already in `state.tabs`; titles/file paths must be joined from `state.notes` by `tab.noteId` (same pattern as `TabsBar`).
- Existing route opening can be as simple as `navigate(`/note/${tab.noteId}`)`, consistent with the all-notes commander. `NotePage` will load the selected note and ensures a tab exists if missing.

## Start Here

Start in `src/app/commander.tsx`. It already has the mode gate for `CommanderType.Notes`; add the opened-tabs mode next to that and build the filtered command list from `state.tabs` + `state.notes`.

Recommended minimal implementation:

1. Add `Tabs`/`OpenTabs` to `CommanderType` in `src/store/global.store.ts`.
2. In `src/app/commander.tsx`, add an `openedTabs` `useMemo` that sorts `state.tabs` by `order`, joins each tab to `state.notes` for the title, and returns flat `CommandItemTypes[]` with actions that close the palette and navigate to `/note/${tab.noteId}`.
3. Add an early branch in `options`: `if (state.commander.type === CommanderType.Tabs) return openedTabs;` before the full-palette construction.
4. In `src/app/elements/shortcut-items.tsx`, import `CommanderType` and add a non-hidden shortcut like `{ bind: "mod+t", description: "Open Tabs", type: Type.Shortcut, action: () => dispatch.commander(true, CommanderType.Tabs) }`.
5. Update `src/app/elements/shortcut-items.test.tsx` to expect the new shortcut if desired. If mocking `CommanderType` becomes necessary, add it to the global.store mock.
6. Consider a small unit test for a pure helper only if one is extracted; otherwise manual verification is likely enough.

Constraints / risks:

- Do not pass `bind="Mod + t"` to the existing `CommandPalette` unless intentionally replacing its default `Mod+k` open binding.
- Do not add the shortcut as `hidden: true` in `useWritemeShortcuts`; hidden shortcuts are skipped by `useShortcuts()` registration.
- Browser `Ctrl/Cmd+T` normally opens a new browser tab. The app shortcut registry calls `preventDefault()` when it matches, so this will intentionally override browser behavior while the app is focused.
- Keep hook ordering in `Commander` simple: any new `useMemo` should be declared before the `options` `useMemo` that references it, and before effects that reference it.
- Use design-system token classes if any empty-state UI is added; no styling changes are required for the minimal path.
