# CLI File Open & $EDITOR Integration

## Context

Writeme has no way to be invoked from the terminal. Users cannot run `writeme file.md` to open a file, and it cannot serve as Claude Code's external editor (`$EDITOR`). This spec adds both capabilities.

## Requirements

1. `writeme /path/to/file.md` opens the file in the running writeme instance, or launches the app if not running
2. `writeme --wait /path/to/file.md` blocks the CLI process until the file's tab is closed — required for `$EDITOR` integration
3. Reuses the existing instance via single-instance lock
4. Files open as regular note tabs in the main window
5. Content is auto-saved back to disk (already handled by existing `filePath` persistence)

## Architecture

Three layers: main process changes, renderer changes, CLI shim script.

### Layer 1: Main Process (`src/main.ts` + new `src/main-process/cli-server.ts`)

**Single-instance lock**: Add `app.requestSingleInstanceLock()` at the top of `main()`. If the lock is not acquired, quit immediately — the first instance receives the args via `second-instance` event.

**Argv parsing**: A `parseCliArgs(argv: string[])` function extracts `filePath` (first non-flag argument, resolved to absolute) and `wait` (presence of `--wait` or `-w`). Called on `process.argv` at startup and on `second-instance` event's argv.

**`second-instance` handler**: Parses forwarded argv, resolves filePath relative to `workingDirectory`, shows/focuses mainWindow, sends `app:open-file` IPC to renderer.

**`open-file` handler**: macOS event for Finder file opens. Same code path as `second-instance`.

**Unix domain socket server** (`src/main-process/cli-server.ts`):
- Listens at `<app.getPath("userData")>/writeme.sock` (macOS/Linux) or `\\.\pipe\writeme-cli` (Windows)
- Started in `app.on("ready")` after window creation
- Accepts JSON messages: `{ filePath: string, wait: boolean, requestId: string }`
- Sends `app:open-file` to renderer
- For `--wait` connections: keeps socket open, stores `requestId → socket` in a Map
- When renderer signals `app:file-closed`, writes `{ status: "closed" }` back to the socket and closes it
- Cleanup: deletes socket file on `before-quit`. Handles `EADDRINUSE` by unlinking stale socket and retrying

**`app:file-closed` IPC handler**: Registered in main.ts. When the renderer calls it with a `requestId`, looks up the socket in the wait Map and signals completion.

### Layer 2: Renderer (`src/app/root-layout.tsx`)

**`useEffect` listener**: Calls `window.electronAPI.onOpenFile()` to listen for `app:open-file` messages from main.

**On receiving `{ filePath, wait, requestId }`**:
1. Query DB for existing note with that filePath via `window.electronAPI.db.notes.getByFilePath(filePath)`
2. If found: navigate to `/note/<id>`, ensure tab exists
3. If not found: read file via `window.electronAPI.fs.readFile(filePath)`, create a new Note with `filePath` set, save via repository, navigate
4. If `wait` is true: store `noteId → requestId` in a module-level Map

**Tab close signaling**: When a tab for a waited noteId is closed, call `window.electronAPI.app.notifyFileClosed(requestId)`. Detection via wrapping the existing `dispatch.removeTab()` call in `tabs-bar.tsx`.

### Layer 3: CLI Shim (`bin/writeme`)

A standalone Node.js script (`#!/usr/bin/env node`):
1. Parses argv for `<filePath>` and `--wait`
2. Resolves filePath to absolute path
3. Connects to the Unix domain socket at the well-known path
4. If connected: sends `{ filePath, wait, requestId }` as JSON. If `--wait`, blocks reading until `{ status: "closed" }` arrives, then exits 0
5. If connection fails (ECONNREFUSED/ENOENT — app not running): spawns the app binary with args (`/Applications/writeme.app/Contents/MacOS/writeme` on macOS, `writeme` on Linux), retries socket connection with backoff until the server is up
6. Socket path discovery: follows Electron's `app.getPath("userData")` convention — `~/Library/Application Support/writeme/writeme.sock` on macOS, `$XDG_CONFIG_HOME/writeme/writeme.sock` or `~/.config/writeme/writeme.sock` on Linux

### Preload Bridge (`src/preload.ts`)

New additions to `electronAPI`:
- `onOpenFile(callback)`: listens for `app:open-file` IPC from main process
- `app.notifyFileClosed(requestId)`: invokes `app:file-closed` IPC
- `db.notes.getByFilePath(filePath)`: invokes `db:notes:getByFilePath` IPC

### Database (`src/main-process/database.ts` + `src/ipc/database.ipc.ts`)

New method `getNoteByFilePath(filePath: string)`:
```sql
SELECT * FROM notes WHERE filePath = ? LIMIT 1
```

Exposed via IPC handler `db:notes:getByFilePath`.

## Files to Create

- `src/main-process/cli-server.ts` — Unix domain socket server
- `bin/writeme` — CLI shim script (Node.js)

## Files to Modify

- `src/main.ts` — single-instance lock, argv parsing, second-instance/open-file events, socket server startup, file-closed IPC handler
- `src/preload.ts` — onOpenFile, notifyFileClosed, getByFilePath bridges + type declarations
- `src/app/root-layout.tsx` — useEffect for file-open listener, note creation/navigation, wait tracking
- `src/app/components/tabs-bar.tsx` — signal file-closed on tab close for waited files
- `src/main-process/database.ts` — getNoteByFilePath query method
- `src/ipc/database.ipc.ts` — expose db:notes:getByFilePath handler
- `package.json` — add "bin" field

## Claude Code Integration

Add to `~/.claude/settings.json`:
```json
{
  "env": {
    "EDITOR": "writeme --wait"
  }
}
```

Where `writeme` refers to the CLI shim in `$PATH`.

## Edge Cases

- **File doesn't exist**: Create it as empty, open in editor. When saved, content is written to disk.
- **Multiple --wait files**: The `requestId → socket` Map supports concurrent wait sessions.
- **App crashes with socket file**: Handle `EADDRINUSE` by checking if the app is actually running (connect attempt), then unlink stale socket.
- **Race on did-finish-load**: When launching fresh with file args, queue the `app:open-file` send until `mainWindow.webContents.once("did-finish-load")`.
- **File content sync**: Existing `updateContent` in notes repository already writes back to `filePath` on save — no extra work needed.

## Verification

1. **Basic open**: Run `node bin/writeme /tmp/test.md` — should open the file in writeme
2. **Reuse instance**: With writeme running, run the command again — should open in existing window
3. **Wait mode**: Run `node bin/writeme --wait /tmp/test.md` — terminal blocks until the tab is closed
4. **Claude Code**: Set `EDITOR` in settings.json, use Claude Code's external editor feature — should open in writeme and return content when tab closes
5. **macOS open-file**: Drag a .md file onto the writeme dock icon — should open
6. **File creation**: Run `node bin/writeme /tmp/new-file.md` where the file doesn't exist — should create and open
