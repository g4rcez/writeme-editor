# writeme

This is designed to be a text editor that help you to interact with AI and took notes with super powers, by using our awesome features.

![thanks](assets/readme/3.png)

## Features

- **AI-Powered Editing**: Native integration with AI for content generation, refinement, and intelligent note-taking.
- **Markdown First**: Full Markdown support using Tiptap and Unified/Remark ecosystems.
- **Graph Visualization**: Interactive 2D force-directed graph to visualize connections between notes and hashtags.
- **Integrated Terminal**: Built-in terminal support (using xterm.js and node-pty) for developers.
- **Read It Later**: Web content scraper that transforms articles into clean, readable notes.
- **Hybrid Storage**: Support for both local filesystem (direct file access) and database-backed (Dexie/SQLite) storage modes.
- **Rich Media & Extensions**: Support for Excalidraw, Mermaid diagrams, KaTeX math, and Shiki syntax highlighting.
- **Cross-Platform**: Available as an Electron desktop application and a Progressive Web App (PWA).

## How to develop

The project uses `npm` as the preferred package manager.

1. **Clone the repository**
2. **Install dependencies**

```bash
npm install
```

3. **Start in development mode**

- For Electron:

  ```bash
  npm run dev
  ```
- For Browser/Web version:

  ```bash
  npm run browser:dev
  ```

## How to build

### Desktop (Electron)

To package the application for your current platform:

```bash
npm run build:package
```

To create distributables (e.g., .deb, .exe, .zip):

```bash
npm run make
```

### Web / PWA

To build the web version and generate PWA assets:

```bash
npm run pwa:build
```

## Roadmap

The following features are currently planned or in development:

- **Search Integration**: Full integration with TipTap Search extension.
- **Trash System**: Implementation of a Trash/Recycle Bin for deleted notes.
- **File Organization**: Implementation of a Folder and Notebook Tree structure in the sidebar.
- **Enhanced Database**: Improved SQLite backend integration for desktop.
- **Advanced Metadata**: Better support for frontmatter and note metadata.

## Troubleshooting

### IPC Communication

If the renderer process cannot communicate with the main process, ensure you are running in the Electron environment. Web-only features may have limited functionality compared to the desktop version.

### Native Modules

If the terminal fails to start on desktop, you might need to rebuild the native `node-pty` dependency:

```bash
./node_modules/.bin/electron-rebuild
```

### Storage Mode

If files are not appearing where expected, check the "Workspace" setting in the dashboard or settings page to verify your current directory configuration.

## LICENSE

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.