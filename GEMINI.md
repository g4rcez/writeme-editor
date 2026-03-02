# [GEMINI.md](http://GEMINI.md)

Instructional context for Gemini CLI when working with the Writeme repository.

## Project Overview

Writeme is a sophisticated, hybrid Electron and Web note-taking application. It's built with React, TypeScript, and the Tiptap editor framework, designed for a high-quality rich text editing experience with advanced features like math solving, code highlighting, and automatic clipboard integration.

### Core Architecture

- **Dual Environment Support**: Operates as both a native Electron application and a Progressive Web App (PWA).
- **Storage Strategy**:
  - **Electron**: Uses SQLite (`better-sqlite3`) for metadata and can optionally sync notes directly to the local filesystem as Markdown files.
  - **Browser/PWA**: Uses IndexedDB (via Dexie.js) for all storage.
  - **Repository Pattern**: Abstracted repository layer (`src/store/repositories/`) handles the environment-specific storage logic.
- **Frontend**: React-based UI using Tailwind CSS and Radix UI primitives. State management is handled via a custom `use-typed-reducer` pattern.
- **Editor**: Heavily customized Tiptap instance with support for:
  - Syntax highlighting (Shiki)
  - Math expressions (Math.js/Katex)
  - Mermaid diagrams
  - Excalidraw integration
  - Markdown-it for rendering

## Core Mandates

- **Testing**: Every feature or bugfix MUST be tested using **Vitest**. No code changes should be considered complete without corresponding test coverage.
- **Component Reuse**: Before creating a new component from scratch, you MUST inspect the `@g4rcez/components` library. Use `Context7` (via `resolve-library-id` and `query-docs`) to inspect available components and patterns to ensure consistency and avoid duplication.
- **Plan First**: Before starting any implementation, you MUST present a detailed plan and discuss it with the user. Proactively ask questions to clarify requirements and resolve any ambiguities before writing code.
- **Avoid Browser Dialogs**: NEVER use `window.alert`, `window.prompt`, or `window.confirm`. These APIs are blocking and inconsistent across environments.
  - **Alerts**: Use the global `Alert` component managed by `uiState.alert`. Trigger it via `uiDispatch.setAlert({ title: "...", message: "...", type: "error" | "success" | "info" })` using the `useUIStore` hook.
  - **Confirmations**:
    - For simple confirmations in functional flows, use `await Modal.confirm({ title: "...", description: "...", confirm: { text: "...", theme: "danger" | "primary" } })` from `@g4rcez/components`.
    - For confirmations that need custom UI or complex state, use the `Confirm` component (`src/app/components/confirm.tsx`).
  - **Prompts**: Implement a custom dialog with form inputs using the `Modal` component. Never use `window.prompt`.

## Key Commands

### Development

- `npm run dev` / `npm start`: Launch the Electron application in development mode with hot-reloading.
- `npm run browser:dev`: Start the web-only development server (Vite).
- `npm run pwa:dev`: Generate PWA assets and start the browser dev server.

### Build & Package

- `npm run browser:build`: Build the web version of the application.
- `npm run build:package`: Package the Electron application.
- `npm run make`: Create distributable installers (DMG, EXE, DEB, etc.) via Electron Forge.

### Quality Assurance

- `npm run lint`: Execute ESLint to check for code quality and style issues.
- `npm test`: Run the test suite using Vitest.

## Development Conventions

### Icon Library

- **Library**: Use `@phosphor-icons/react` for all icons.
- **Import Pattern**: Always import icons from the `dist/csr` directory to ensure Client-Side Rendering compatibility and smaller bundle sizes.
  - **Example**: `import { IconNameIcon } from "@phosphor-icons/react/dist/csr/IconName"`
- **Consistency**: Ensure all new icons follow this pattern and existing Lucide icons are replaced when modifying components.

### Code Structure

- **Components**: Functional React components using TSX. Located in `src/app/components/` and `src/app/elements/`.
- **State**: Global state resides in `src/store/global.store.ts`. Use dispatchers for all state updates.
- **IPC**: Communication between Electron's main and renderer processes must be defined in `src/ipc/` and exposed via `src/preload.ts`.
- **Styling**: Use Tailwind CSS utility classes. Prefer the `cn` utility (from `src/lib/cn.ts` if available, otherwise `clsx`) for conditional class merging.

### Contribution Guidelines

- **Strict Typing**: TypeScript is enforced. Avoid `any` and prefer explicit types for function returns and component props.
- **Environment Awareness**: Always check `isElectron()` when using platform-specific APIs (like filesystem or IPC).
- **Persistence**: Ensure data operations are handled through the repository layer to maintain compatibility between Electron and Browser modes.
- **Testing**: Add unit tests in `.test.ts` or `.test.tsx` files alongside the implementation when introducing new core logic.