# Memory report: idle RAM and leak work

Measured 2026-10-27 on macOS (arm64), Electron 44, packaged builds of the same commit with and without the changes.
Raw results: [`memory-ab-results.json`](./memory-ab-results.json).

## What this does and does not show

- **The reported 6 GB was not reproduced.** On the synthetic workspace below the whole app idles at about 0.5 GB before the
  changes and 0.3 GB after. This report shows where memory went, which causes are removed and by how much, but it cannot
  say the 6 GB is gone. The main window still holds the full text of every note in its renderer heap (54 MB for 1,500 notes),
  so a much larger workspace scales that part linearly.
- **Cumulative A/B only.** The two builds differ by all changes together; no MB figure is attributed to a single change.
- **Resident size (RSS) is unusable on the test machine.** Swap was almost full (about 48 of 49 GB), and RSS for one build
  swung from 341 to 839 MB between identical runs. The headline metric is the **physical footprint** (`footprint`, the figure
  Activity Monitor shows, including compressed and swapped pages), plus **retained heap after a forced GC**.
- Baseline idle varied between sessions (464 to 503 MB). The ranges in the table are within one session.

## Can floating windows share memory with the main process?

No. Every Electron window is its own renderer process with its own JS heap, so heap cannot be shared. What can be avoided
is duplicating the data. A floating window now:

- gets note titles and paths (metadata from SQLite, no file reads, no content) instead of loading the whole workspace,
- no longer restarts the file watcher,
- no longer runs the hourly purge,
- loads the one note it opens on demand.

Result: opening a quick-note window costs 4 file reads instead of 5,532, and its JS heap is about 36 MB instead of about
104 MB. The remaining cost per open window is about 90 MB of physical footprint, which is Chromium's per-process base for
a renderer plus the app's 8 MB startup bundle. That part cannot be shared between processes.

## Method

- Workspace generated deterministically: 1,500 notes of about 8 KB, 5 notes of about 300 KB, and 4,000 files under a `.venv`
  dot-folder, opened in filesystem mode (the `directory` setting is seeded, then the app is started cold).
- Each build runs the same scenario 3 times, alternating builds: startup, 10 s idle, create a note and save it 5 times,
  change one file and add one file on disk behind the app's back, open 3 quick-note windows and close them, respawn a
  terminal, run a 5 MB code-block command.
- IPC traffic is counted by wrapping `ipcMain.handle` in a bootstrap script. Heap numbers are taken after a forced GC in
  the main process and in every renderer.
- Both builds are started through the same bootstrap (as `tests/native/*.spec.ts` already do).

## Results

Workspace: 1500 notes (~8 KB each), 5 large notes (~300 KB), 4000 files under a dot-folder. Median of 3 run(s) per build, min–max in brackets.

### Memory: physical footprint of all Electron processes (what Activity Monitor shows)

| Metric | baseline | after | Change |
| --- | ---: | ---: | ---: |
| Idle total, 10 s after startup | 489 (464–503) MB | 315 (312–315) MB | -36% |
|   main process | 177 (168–187) MB | 94 (91–95) MB | -47% |
|   renderer | 217 (216–224) MB | 113 (112–114) MB | -48% |
|   GPU + utility | 81 (57–81) MB | 81 (81–81) MB | 0% |
| After creating a note and saving 5 times | 516 (500–534) MB | 307 (303–310) MB | -41% |
| With 3 quick-note windows open | 1160 (1105–1227) MB | 588 (585–589) MB | -49% |
| After closing them | 551 (504–582) MB | 278 (278–283) MB | -50% |

### Memory: retained after a forced garbage collection

| Metric | baseline | after | Change |
| --- | ---: | ---: | ---: |
| Renderer JS heap, idle | 141 (133–141) MB | 54 MB | -62% |
| Main process heap, idle | 21 (21–21) MB | 16 (16–16) MB | -23% |
| Renderer JS heap, 3 quick-note windows open (all windows) | 453 (444–453) MB | 161 MB | -64% |
| Renderer JS heap, after closing them | 141 (133–141) MB | 54 MB | -62% |

### Memory: resident set size (noisy while the OS swaps, kept for reference)

| Metric | baseline | after | Change |
| --- | ---: | ---: | ---: |
| Idle total | 952 (946–964) MB | 667 (662–668) MB | -30% |

### Workspace reads (IPC `fs:readFile` calls)

| Metric | baseline | after | Change |
| --- | ---: | ---: | ---: |
| Startup | 3010 calls | 1505 calls | -50% |
| Creating one note | 3013 calls | 1 calls | -100% |
| One autosave (median of 5) | 1508 calls | 2 calls | -100% |
| Modifying one file on disk | 1506 calls | 1 calls | -100% |
| Adding one file on disk | 1507 calls | 1 calls | -100% |
| Opening one quick-note window | 5532 calls | 4 calls | -100% |
| Time until the app is idle after launch | 2011 (2009–2013) ms | 1507 (1506–1513) ms | -25% |

### Bundle loaded at startup

| Metric | baseline | after | Change |
| --- | ---: | ---: | ---: |
| JS loaded eagerly | 28496 KB | 8135 KB | -71% |
| Heavy libraries loaded eagerly (shiki, excalidraw, mermaid, graphviz, mathjs) | 5 chunks | 0 chunks | -100% |

### File handles and processes

| Metric | baseline | after | Change |
| --- | ---: | ---: | ---: |
| Open file descriptors in main | 5647 (5646–5647) fds | 1647 (1646–1647) fds | -71% |
| Electron processes, idle | 4 procs | 4 procs | 0% |
| Orphaned shells after respawn + kill | n/a shells | 0 shells | n/a |
| Captured stdout of a 5 MB command | 5000000 chars | 1000000 chars | -80% |

Idle footprint per run (MB): baseline [464, 489, 503], after [315, 312, 315]

## What changed and why it helps

| Cause found | Change | Evidence in the table |
| --- | --- | --- |
| The Vite `manualChunks` rule grouped all of Shiki (every grammar and theme), Mermaid, Excalidraw, Graphviz and mathjs into chunks that the entry chunk imported, so they loaded and were parsed at startup | Removed those rules so they load on demand; Prettier plugins are imported only when a block is formatted | Eagerly loaded JS 28.5 MB to 8.1 MB, heavy chunks 5 to 0, renderer heap 141 to 54 MB |
| Opening any note ran the comments lookup, which called `notes.getAll()` (every file); the effect also re-ran on every autosave | The effect depends on the note's id, path, title and project; the lookup reads SQLite metadata instead of every file | Creating a note 3,013 to 1 read, one autosave 1,508 to 2 |
| The watcher ignored `..` instead of dot-folders, descended 10 levels, restarted on every window, and reported the app's own file creations | Fixed the ignore pattern, depth 3, a restart on the same directory is a no-op, own `add`/`unlink` are suppressed, write records are pruned | File descriptors 5,647 to 1,647 |
| Every file event re-read the whole workspace (1 read per note) | A changed file refreshes only that note; added or removed files load only the files that appeared (`syncWorkspaceDelta`); the directory event is debounced to 400 ms | Modifying or adding a file on disk 1,506 to 1 read; the new note is still indexed |
| `getAll` ran an unbounded `Promise.all` over every file, and `getAll({limit})` read everything and sliced | Reads capped at 16 in flight; `limit` uses the SQL `LIMIT` and reads only those files; recent notes and the terminal helper use the metadata query | Unit tests; startup reads 3,010 to 1,505 (see note) |
| Floating windows loaded the whole workspace, restarted the watcher and ran the purge. The daily-note lookup also read every file | Metadata-only list, no watcher restart, purge only in the main window, daily-note lookup reads one file | Quick-note window 5,532 to 4 reads; 3 windows 1,160 to 588 MB |
| Each editor stored a snapshot array of every note; only the active editor was updated, and the markdown cache key pinned an old array | A live getter reads the current notes; the cache key is a `WeakRef`; the editor no longer re-renders when notes change | Unit tests; renderer heap |
| A new `Note` object replaced an unchanged one on every reload | `setNotes` keeps the previous object when updatedAt and content are unchanged | Unit tests |
| Excalidraw rewrote the whole code block (and an undo step holding the full previous JSON) on every pointer/state change | Cheap scene signature, 500 ms debounce, flush on close, rewrite not recorded in undo history | Unit tests |
| Search normalized and `Array.from`-ed full content for every note on every keystroke | Subsequence reject first, fuzzy scoring over the first 20k characters (a contiguous match anywhere still counts), capped snippets, deferred query, per-query snippet cache | Unit tests, including a 2 MB note scored in under a second |
| Media preview created one blob URL per sibling file and never released it | URLs are revoked when the preview closes or is replaced | Unit test |
| Terminal: a replaced shell's late exit removed the new shell from the session map, leaving it untracked | Identity check on exit; shells are killed with their window | Unit tests |
| **Terminal never started in the packaged app.** `AutoUnpackNativesPlugin` unpacks only `*.node`, so node-pty's `spawn-helper` stayed inside `app.asar` and every spawn failed with `posix_spawnp failed` | `forge.config.ts` also unpacks `**/node_modules/node-pty/**/spawn-helper` and sets it executable | A shell now starts in the packaged app and none is orphaned after a respawn |
| AI runner: a replaced process's `close` cleared the reference to the new one | Same identity check; destroyed windows are not written to | Unit tests |
| Code execution: no timeout, unbounded output | 60 s timeout, 1 MB output cap, killed with its window | Captured output 5,000,000 to 1,000,000 chars |

Note on startup reads: they halved (3,010 to 1,505), but I did not isolate which change did it.

## Not done

- **Reusing an open floating window** was tried and reverted: existing tests require independent quick-note and math windows.
- About 30 other `notes.getAll()` call sites remain (explorer actions, tag and agenda pages, AI tools, importers). Each is a
  full workspace read when it runs, though none runs on a normal save, open or file event any more.
- The explorer's media preview still reads every sibling image into memory before showing one (the blob URLs are now freed).
- Lists are still not virtualized, and `editorProps` is still rebuilt on each render.
- The main window still holds every note's full text in memory; making that lazy is a larger change.

## Side findings

- `tests/native/context-pane.spec.ts` fails with a 30 s click timeout on both the baseline and the final build, so it is
  not caused by these changes.
- `store/tabs.test.ts` ("removes terminal metadata when closing a terminal tab") fails with and without these changes.

## Tests

| Test | What it asserts | Fails on the old code? |
| --- | --- | --- |
| `tests/native/memory-footprint.spec.ts` | Bundle, reads (startup, create, autosave, external change, quick-note window), file handles, heap, captured output, terminal start and orphans, on a packaged build | Yes: every budget except two harness guards (checked on the baseline build) |
| `main-process/file-watcher.test.ts` | Dot-folders ignored, depth bound, no restart, own writes suppressed, records pruned | Yes |
| `ipc/terminal.ipc.test.ts`, `ipc/execution.ipc.test.ts`, `main-process/ai-runner.test.ts` | Process tracking, timeout, output cap, destroyed windows | Yes, except guard cases |
| `store/repositories/electron/notes.repository.test.ts` | `limit` without a scan, 16-read cap, directory delta sync, daily-note lookup without a scan | Yes |
| `store/global.store.test.ts`, `lib/editor-storage.test.ts`, `lib/map-concurrent.test.ts`, `lib/editor-utils.history.test.ts` | Stable note identity, live notes source, concurrency limit, undo history opt-out | Yes |
| `lib/note-search.test.ts`, `app/elements/code-block/excalidraw.test.tsx` | Long-content search, debounced and flushed Excalidraw write-back | New cases |
| `store/ui.store.media-preview.test.ts`, `lib/window-mode.test.ts`, `lib/bundle-chunks.test.ts` | Blob revocation, secondary-window detection, no forced heavy chunks | Yes, except one guard each |
| `app/elements/code-block-formatting.test.ts` | Formatting still works with lazily loaded plugins | No (behavior preserved) |

Existing native Electron specs that exercise the changed code still pass: comments (SQLite and filesystem), search and
Views, workspace agenda (daily note), editor completion.

## Reproduce

```bash
npm run package:app                         # packaged build in out/
WRITEME_MEMORY_BUILD=out/writeme-darwin-arm64 \
  WRITEME_E2E_PREBUILT=1 WRITEME_E2E_SUITE=native WRITEME_E2E_PROJECTS='["native-osx"]' \
  npx playwright test -c playwright.osx.config.ts tests/native/memory-footprint.spec.ts

# A/B between two packaged builds (each dir contains writeme.app):
node --import tsx scripts/measure-memory.mts --runs 3 \
  --build baseline=/path/to/old --build after=/path/to/new --out result.json
node --import tsx scripts/memory-report.mts result.json baseline after
```

`npm run test:e2e -- --suite native` repackages the app into `out/` first; the `WRITEME_E2E_PREBUILT=1` form above does not.

## To find the real 6 GB

The lab cannot see it, so measure the instance that holds it: sort Activity Monitor by process (or log
`app.getAppMetrics()`) to learn whether the memory is in the main process, one renderer or many windows, then take a heap
snapshot of that renderer and look at retained strings and `Note` objects.
