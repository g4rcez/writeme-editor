# Technology Stack - writeme

## Core Technologies
- **Runtime:** [Electron](https://www.electronjs.org/) - Desktop application wrapper.
- **Frontend Framework:** [React 19](https://react.dev/) - UI library for building the interface.
- **Language:** [TypeScript](https://www.typescriptlang.org/) - Typed superset of JavaScript for robust development.
- **Build Tool:** [Vite](https://vitejs.dev/) - Next-generation frontend tooling for fast development and bundling.
- **Testing:** [Vitest](https://vitest.dev/) and [React Testing Library](https://testing-library.com/) - Unit and integration testing.

## Editor & Content
- **Editor Engine:** [Tiptap](https://tiptap.dev/) - Headless rich-text editor framework based on ProseMirror.
- **Markdown Support:** `tiptap-markdown` and various `unified`/`remark`/`rehype` plugins for high-fidelity processing.
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework for rapid UI development.
- **Syntax Highlighting:** [Shiki](https://shiki.style/) - Powerful syntax highlighter for code blocks.
- **Math & Diagrams:** 
  - [KaTeX](https://katex.org/) - Fast math typesetting.
  - [Mermaid](https://mermaid.js.org/) - Diagramming and charting tool.
  - [Excalidraw](https://excalidraw.com/) - Virtual whiteboard for hand-drawn-like diagrams.

## Architecture & Data
- **Database:** [Dexie.js](https://dexie.org/) - Minimalistic wrapper for IndexedDB for local, offline-first data persistence.
- **Routing:** [TanStack Router](https://tanstack.com/router) - Fully type-safe router for React applications.
- **Form Management:** [TanStack Form](https://tanstack.com/form) - Type-safe form logic.
- **State Management:** `use-typed-reducer` and localized stores for managing application state.
