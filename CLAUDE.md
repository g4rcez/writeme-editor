# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Writeme is an Electron-based note-taking application built with React, TypeScript, and Tiptap editor. It also runs as a browser PWA. Features include rich text editing, syntax highlighting (Shiki), math solving (mathjs/KaTeX), Mermaid diagrams, Excalidraw, AI chat, and clipboard monitoring.

## Common Development Commands

- `npm run dev` - Start Electron app in development mode (alias for `native:dev`)
- `npm run browser:dev` - Start as browser app with Vite dev server
- `npm run lint` - Run ESLint on TypeScript/TSX files
- `npm run test` - Run tests with Vitest
- `npm run make` - Build Electron distributables via Electron Forge
- `npm run pwa:build` - Build browser PWA version

## Path Alias

`@/*` maps to `src/*`. Always use `@/` alias in code — never use relative paths like `../../`.

## Architecture Overview

### Electron Process Separation

- **Main Process** (`src/main.ts`): BrowserWindow, IPC handlers, tray icon, global shortcuts, SQLite database
- **Preload Script** (`src/preload.ts`): `contextBridge.exposeInMainWorld("electronAPI", {...})` — typed API bridge
- **Renderer Process** (`src/app/main.tsx`): React app with hash-based routing in Electron, browser routing in PWA

### Dual Storage Architecture

The app uses a **repository adapter pattern** to support two storage backends:

- **Browser mode** (`src/store/repositories/browser/`): Dexie.js (IndexedDB) — used in PWA
- **Electron mode** (`src/store/repositories/electron/`): better-sqlite3 (SQLite) — used in desktop app

Factory in `src/store/repositories/index.ts` selects implementation via `isElectron()`. All repositories implement interfaces from `src/store/repositories/entities/`. In Electron mode, notes can also be persisted as `.md` files on disk (filesystem storage mode).

Repositories: `notes`, `tabs`, `hashtags`, `settings`, `scripts`, `ai`

### State Management

Uses `use-typed-reducer` with `createGlobalReducer` pattern in `src/store/global.store.ts`. Access via:

```typescript
const [state, dispatch] = useGlobalStore();
dispatch.selectNoteById(noteId);
```

Secondary stores: `ui.store.ts` (focus mode), `cursor-position.store.ts` (per-note cursor caching).

### Editor System

Core editor: `src/app/editor.tsx` using Tiptap (ProseMirror-based).

- **Extension registration**: `src/app/extensions.tsx` — `createExtensions()` assembles all Tiptap extensions
- **Custom node views** (React components): `src/app/elements/` — code-block, callout, frontmatter, mermaid, excalidraw, youtube, math-block, task-list-item, blockquote
- **Custom markdown parser/serializer**: `src/app/extensions/tiptap-markdown/` — custom Markdown extension with parse/serialize directories, custom node/mark handlers
- **Inline commands** (`>>math`, `>>money`, `>>eval`, `>>time`): `src/app/commands/commands.ts` — `ReplacerCommands` extension with regex-based `replacerRules`
- **Hashtag decorations**: `src/app/extensions/hashtag.ts` — ProseMirror plugin
- **Mention suggestions**: `src/app/extensions/suggestion.tsx`
- **Global editor ref**: `src/app/editor-global-ref.ts` — allows command palette and other UI to interact with the active editor

**Editor pitfalls**:

- Tiptap suggestion `items()` must never reject — a rejected promise silently kills the popup. Always try-catch and return `[]` on error.
- tiptap-markdown `renderList` reads `node.attrs.tight` (falls back to `state.options.tightLists`). Setting `state.tight` is dead code. Extensions controlling list tightness must register a `tight` attribute on the node.
- For inline atom nodes (e.g., Mention), override `renderText()` to control clipboard and markdown output.
- Dexie schema migrations: cannot remove IndexedDB tables — only add. Version numbers must be monotonically incremented.

### IPC Communication

IPC handlers organized by domain in `src/ipc/`:

- `notes.ipc.ts` — filesystem operations (`fs:*`), clipboard
- `database.ipc.ts` — generic CRUD (`db:*`), note/tab/hashtag operations
- `app.ipc.ts` — quick note window, environment info
- `execution.ipc.ts` — shell command execution

AI IPC handlers are registered directly in `src/main.ts` (`ai:query`, `ai:stop`, `ai:get-configs`, etc.).

Pattern: `ipcMain.handle("channel:name", handler)` in main process → `ipcRenderer.invoke("channel:name")` exposed via preload.

**Electron sandbox rules**:

- Renderer and preload cannot access `process.env` directly. Use `app.getPath()` in main process, expose via IPC.
- `window.electronAPI.env.getHome()` is async — always `await` it.
- All `window.electronAPI.*` calls must be guarded with `isElectron()`.
- Tray icon path: `path.join(app.getAppPath(), "public/filename.png")` — `public/` is not accessible via relative paths from main process.

### Routing

Hash-based router for Electron, browser router for PWA (`src/app/router.tsx`). Key routes:

- `/note/:noteId` — note editor
- `/quicknote` — quick note creation
- `/templates/:templateId` — template editor
- `/settings`, `/tags/:tag`, `/notes`, `/read-it-later`

Root layout (`src/app/layouts/root-layout.tsx`) handles keyboard bindings, dialog management, and AI drawer.

### Styling

- Tailwind CSS 3 with `@g4rcez/components/preset.tailwind` preset
- Dark mode via `"class"` strategy
- Theme tokens generated at runtime from `@g4rcez/components` TokenRemap
- Dynamic font sizing via `--default-size` CSS variable
- Fonts: IBM Plex Sans (body), Outfit (headings), JetBrains Mono (code)
- Editor-specific styles: `src/app/styles/typography.css`, `src/app/styles/code.css`

### Key Dependencies

- **@phosphor-icons/react** — icon library (only icon source — `lucide-react` was removed, never import it)
- **@g4rcez/components** — custom component library with Tailwind preset and theme system
- **use-typed-reducer** — typed state management
- **react-hotkeys-hook** — keyboard shortcuts
- **zod** — schema validation

### How to Add a New Editor Extension

1. Create React node view in `src/app/elements/my-block.tsx` (or pure extension in `src/app/extensions/`)
2. Use `Node.create()` / `Extension.create()` from `@tiptap/core`
3. Register in `createExtensions()` in `src/app/extensions.tsx`
4. If markdown support is needed, add node/mark handlers in `src/app/extensions/tiptap-markdown/extensions/`

### How to Add a New Repository

1. Define interface in `src/store/repositories/entities/`
2. Create browser implementation in `browser/` using Dexie
3. Create electron implementation in `electron/` using IPC to SQLite
4. Add to `Result` type and `getRepositories()` in `src/store/repositories/index.ts`

### Note Entity

`src/store/note.ts` — `Note` class with static factory `Note.new(title, content, noteType?)`. Note types: `"note"`, `"quick"`, `"read-it-later"`, `"template"`. `noteType` defaults to `"note"`.

**Important**: `storageDirectory` (filesystem path) and note identity are semantically different — never pass `storageDirectory` as a logical ID.