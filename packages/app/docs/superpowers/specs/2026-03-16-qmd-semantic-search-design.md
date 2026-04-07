# qmd Semantic Search Integration

**Date**: 2026-03-16
**Status**: Draft

## Problem

Writeme's current search is a naive substring match against note titles and content held in memory. It has no ranking, no relevance scoring, and no semantic understanding. Finding "the best note from a sentence" — the core use case — is impossible without already knowing the exact words used.

## Goal

Replace the sidebar search with a hybrid semantic search engine (BM25 + vector embeddings + LLM reranking) powered by [qmd](https://github.com/tobi/qmd). Works fully locally, on-device. Electron gets the full qmd SDK in the main process; browser gets a qmd HTTP daemon with Fuse.js fallback.

---

## Architecture

Follows the existing repository adapter pattern (`isElectron()` → implementation selection).

```
ISearchRepository (service interface, not a CRUD repository)
├── ElectronSearchRepository   ← @tobilu/qmd SDK, runs in main process via IPC
└── BrowserSearchRepository    ← HTTP client to qmd daemon, falls back to Fuse.js
```

`ISearchRepository` intentionally does NOT extend `Repository<T>` from the entity base. It is a search service, not a CRUD entity store — it has no `getAll`, `getOne`, `save`, `delete` operations, and wiring it into the generic `Repository<T>` shape would produce misleading dead methods. This deviation is deliberate and should be documented at the interface definition site.

### Interface (`src/store/repositories/entities/search.ts`)

```ts
export type SearchInitState = "pending" | "indexing" | "ready" | "error"

export interface ISearchRepository {
  /** Initialize the search engine (async; must be awaited before search works) */
  init(): Promise<void>
  /** Current engine state — used by UI to show loading/error state */
  state(): SearchInitState
  /** Hybrid semantic search (or fuzzy fallback in browser).
   *  `notes` is used by BrowserSearchRepository for Fuse.js; Electron implementations ignore it. */
  search(query: string, limit?: number, notes?: Note[]): Promise<SearchResult[]>
  /** Index or re-index a single note. Accepts minimal payload, not full Note. */
  index(entry: SearchEntry): Promise<void>
  /** Bulk index on startup. Main-process-only for Electron; no-op for browser. */
  indexAll(entries: SearchEntry[]): Promise<void>
  /** Remove a note from the index */
  remove(noteId: string): Promise<void>
  /** Is the search engine ready and reachable? */
  isAvailable(): Promise<boolean>
}

export type SearchEntry = {
  noteId: string
  title: string
  content: string
  noteType: NoteType   // needed for correct navigation in results
}

export type SearchResult = {
  noteId: string
  title: string
  excerpt: string
  score: number
  noteType: NoteType   // used by search-pane to route correctly (note vs template)
}
```

---

## Initialization & Model Download

qmd downloads the embedding model on first use (`embed()` call). This can take minutes on first launch. The search engine must not block the UI.

### Init flow (Electron)

1. App ready → `searchRepository.init()` called from `src/main.ts` (async, non-blocking)
2. `init()` calls `createStore(...)`, then `update()` (load existing index), then `embed()` (download model + generate embeddings for any un-embedded docs)
3. `state()` returns `"pending"` → `"indexing"` → `"ready"` (or `"error"` on failure)
4. `userData` path obtained via `app.getPath('userData')` in main process; qmd store at `{userData}/qmd/`, sync dir at `{userData}/qmd-sync/`. These paths are never passed to the renderer — they live entirely in the main process.
5. `search:status` IPC channel exposes `{ state: SearchInitState, available: boolean }` to the renderer

### Init flow (Browser)

- `init()` pings `http://localhost:3847` (or user-configured URL from settings)
- Sets `state()` to `"ready"` if daemon responds, `"error"` otherwise
- Falls back to Fuse.js immediately; Fuse.js requires no initialization time

---

## Data Flow & Sync Strategy

**No file-watching.** qmd has no built-in directory watcher. All re-indexing is triggered explicitly by hooks in the app.

### Electron — filesystem storage mode
- qmd store initialized at `{userData}/qmd/`, collection pointed at the notes directory (`storageDirectory` setting, resolved in main process)
- `indexAll` on startup: calls `update()` + `embed()` for all existing notes
- On note save: `search:index` IPC fires → main process calls `update({ id, title, content })` + schedules `embed()` via serial queue (see below)
- On note delete: `search:remove` IPC fires → main process removes doc from qmd store

### Electron — SQLite storage mode
- Sync directory at `{userData}/qmd-sync/`; created on first launch if absent
- On note save: `{userData}/qmd-sync/{noteId}.md` written with title + content
- On note delete: `{userData}/qmd-sync/{noteId}.md` unlinked
- `indexAll` on startup: writes all SQLite notes to sync dir, then calls `update()` + `embed()`
- qmd's collection points at `{userData}/qmd-sync/`; re-indexed explicitly, not by watch

### Browser — qmd daemon available
- `init()` pings daemon; on success, all `search()` calls proxy to daemon's HTTP API
- User is responsible for pointing the qmd daemon at their notes directory
- `isAvailable()` is re-checked per-query (not just on mount) so mid-session daemon loss is detected immediately and Fuse.js takes over without requiring a reload

### Browser — qmd daemon unavailable
- Fuse.js initialized with the `notes` array passed in at query time (see BrowserSearchRepository design below)
- `state()` returns `"ready"` immediately; no download, no blocking

### Auto-index hooks in `src/store/global.store.ts`

Hook into two dispatchers — both are needed:

- **`note` dispatcher** (line ~309): handles explicit note creates and title changes → call `searchRepository.index({ noteId, title, content, noteType })`
- **`updateNoteContent` dispatcher** (line ~360): handles high-frequency content saves → call `searchRepository.index(...)` but **only if the note has not been indexed in the last 10 seconds** (simple timestamp check in the IPC handler's serial queue to avoid hammering `embed()`)

The 10-second cooldown is per-note and tracked in the main process, not the renderer.

---

## IPC Layer (Electron)

New file: `src/ipc/search.ipc.ts`

Channels:
- `search:query` — `{ query: string, limit?: number }` → `SearchResult[]`
- `search:index` — `{ noteId: string, title: string, content: string, noteType: NoteType }` (narrow payload, not full Note)
- `search:remove` — `{ noteId: string }` → `void`
- `search:status` — `{}` → `{ state: SearchInitState, available: boolean }`

**Serial queue in main process**: `update()` + `embed()` calls are enqueued and processed one at a time to prevent concurrent embedding races. Implemented with a simple promise chain (`queue = queue.then(() => doIndex(entry))`).

Registered in `src/main.ts` after `app.whenReady()`, exposed via `src/preload.ts` contextBridge under `window.electronAPI.search`.

`indexAll` is main-process-only (called from `init()` in the main process directly). It does not need an IPC channel — the renderer never calls it.

---

## `BrowserSearchRepository` design

The repository cannot subscribe to React state directly. Instead:

- `search(query, limit?, notes?)` accepts an optional `notes` parameter
- `search-pane.tsx` passes `state.notes` when calling `searchRepository.search(query, 20, state.notes)`
- If daemon is available, `notes` param is ignored (daemon handles its own index)
- If Fuse.js fallback: construct `new Fuse(notes, fuseOptions)` inline per-query (fast enough on typical note counts; no persistent Fuse instance needed)
- This keeps the repository stateless for the fallback path

---

## UI Changes

**`src/app/components/sidebar/search-pane.tsx`**:
- Input behavior unchanged (debounced)
- Replace inline `notes.filter(...)` with `await searchRepository.search(query, 20, state.notes)`
- Results display: title, 1–2 sentence excerpt from qmd, subtle relevance indicator
- Loading spinner during async query
- Status chip reflects `searchRepository.state()`:
  - `"pending"` / `"indexing"`: "Building search index…"
  - `"ready"` + qmd: "Powered by qmd"
  - `"ready"` + Fuse.js: "Fuzzy search (qmd unavailable)"
  - `"error"`: "Search unavailable"
- `noteType` on `SearchResult` used to route clicks correctly: templates → `/templates/:id`, others → `/note/:id`

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/store/repositories/entities/search.ts` | Interface + SearchResult, SearchEntry, SearchInitState types |
| `src/store/repositories/electron/search.repository.ts` | qmd SDK wrapper, serial queue, init flow |
| `src/store/repositories/browser/search.repository.ts` | Daemon HTTP client + inline Fuse.js fallback |
| `src/ipc/search.ipc.ts` | IPC handlers for main process |

## Files to Modify

| File | Change |
|------|--------|
| `src/store/repositories/index.ts` | Add `search: ISearchRepository` to `Result` type and `getRepositories()` |
| `src/main.ts` | Register search IPC handlers; call `searchRepository.init()` after `app.whenReady()` |
| `src/preload.ts` | Expose `search:query`, `search:index`, `search:remove`, `search:status` via contextBridge |
| `src/app/components/sidebar/search-pane.tsx` | Use searchRepository, pass state.notes, async results, excerpts, status chip |
| `src/store/global.store.ts` | Hook index/remove into `note` and `updateNoteContent` dispatchers |

---

## Dependencies

- `@tobilu/qmd` — qmd TypeScript SDK (main process only; never bundled into renderer)
- `fuse.js` — browser fallback fuzzy search (renderer only)

---

## Implementation Order

1. Interface + types (`entities/search.ts`)
2. IPC layer (`search.ipc.ts` + `main.ts` registration + `preload.ts`)
3. Electron repository with init flow and serial queue (`electron/search.repository.ts`)
4. Browser repository with daemon client + Fuse.js fallback (`browser/search.repository.ts`)
5. Factory wiring (`repositories/index.ts`)
6. Auto-index hooks in both dispatchers (`global.store.ts`)
7. Search pane UI with status chip and async results (`search-pane.tsx`)

---

## Verification

1. **Electron (filesystem mode)**: Create 3 notes with different topics; search with a sentence describing one → correct note appears first in results
2. **Electron (SQLite mode)**: Same test; confirm `{userData}/qmd-sync/*.md` files exist for all notes
3. **Browser (daemon up)**: Start `qmd serve`; open PWA; search → status chip shows "Powered by qmd", results from daemon
4. **Browser (no daemon)**: Stop daemon; search → status chip shows "Fuzzy search (qmd unavailable)", Fuse.js results, no errors
5. **Auto-index**: Create a new note; search for its title → appears in BM25 results immediately; vector/semantic results available after embed completes (latency expected)
6. **Delete sync**: Delete a note; search for its content → no longer returned
7. **Init state**: On first Electron launch, observe status chip shows "Building search index…" during model download, then transitions to "Powered by qmd"
8. **Routing**: Ensure clicking a template search result navigates to `/templates/:id`, not `/note/:id`
