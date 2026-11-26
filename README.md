# writeme

This is designed to be a text editor that help you to interact with AI and took notes with super powers, by using our awesome

## Features

- **AI-Powered Editing**: Research workspace notes with source links; per-note Markdown proposals require explicit approval before application in database-backed storage. Filesystem-backed proposals remain review-only to avoid overwriting external edits.
- **Markdown First**: Full Markdown support using Tiptap and Unified/Remark ecosystems.
- **Graph Visualization**: Interactive 2D force-directed graph to visualize connections between notes and hashtags.
- **Integrated Terminal**: WTerm with Ghostty rendering and node-pty shells on desktop; a virtual just-bash shell in the browser.
- **Read It Later**: Web content scraper that transforms articles into clean, readable notes.
- **Hybrid Storage**: Support for both local filesystem (direct file access) and database-backed (Dexie/SQLite) storage modes.
- **Rich Media & Extensions**: Support for Excalidraw, Mermaid diagrams, KaTeX math, and Shiki syntax highlighting.
- **Cross-Platform**: Electron desktop application, Progressive Web App (PWA), and Capacitor iOS/Android packages. AI is disabled in the mobile packages.

## Demo

Create a note in the browser, add a short plan, and find it again with search.

<video controls playsinline preload="metadata" width="100%" poster="https://raw.githubusercontent.com/g4rcez/writeme-editor/main/docs/assets/writeme-browser-demo-poster.png">
  <source src="https://raw.githubusercontent.com/g4rcez/writeme-editor/main/docs/assets/writeme-browser-demo.mp4" type="video/mp4">
  <a href="https://raw.githubusercontent.com/g4rcez/writeme-editor/main/docs/assets/writeme-browser-demo.mp4">Download the demo video</a>
</video>

Recorded by the [Playwright demo test](tests/e2e/readme-demo.spec.ts).

## Installation

### macOS — Homebrew

**Desktop app and CLI:**

```bash
brew install --cask g4rcez/tap/writeme
```

**CLI only:**

```bash
brew install g4rcez/tap/writeme-cli
```

The app is signed with a Developer ID and notarized by Apple, so it opens without any extra step. It needs a Mac with Apple
silicon and macOS 13 or later.

### Desktop downloads

Download the desktop app for your platform from the [latest release](https://github.com/g4rcez/writeme-editor/releases/latest):

| Platform                      | File                                                  |
| ----------------------------- | ----------------------------------------------------- |
| macOS (Apple silicon)         | `writeme-<version>-arm64.dmg`, signed and notarized   |
| Windows (x64)                 | `writeme-<version>-setup.exe`                         |
| Linux (Debian/Ubuntu, x64)    | `writeme-<version>-amd64.deb`                         |
| Linux (Fedora/RHEL, x64)      | `writeme-<version>-x86_64.rpm`                        |

### Writeme CLI

The desktop app includes a platform-matched `writeme` CLI. In the desktop app, open the command palette and run **Install CLI**. Then use `writeme .` to open the current directory as a vault, or `writeme /path/to/note.md` to open a file. The `--wait` (or `-w`) flag makes file opening suitable for external-editor integrations.

Alternatively, install the portable npm package with Node.js 22.13 or later:

```sh
npm install --global @writeme.dev/cli
```

To publish a new CLI version, run `npm run release -- cli patch` from the repository root (or use `minor`, `major`, or an explicit version). The release command validates the package before publishing it to the public npm registry.

For Ctrl+G prompt editing in Claude Code, Codex, Pi, or another CLI that uses the standard editor variables, configure `EDITOR="writeme --wait"` and `VISUAL="$EDITOR"` in the shell before launching that CLI. See the [CLI guide](packages/cli/README.md) for platform-specific examples.

---

## How to develop

The project uses `npm` as the preferred package manager.

Android and iOS builds are available as GitHub Actions artifacts on `main` and are attached to new tagged releases alongside the desktop downloads. Android provides an installable debug APK; iOS provides an unsigned device IPA that requires signing before installation. See the [mobile pipeline downloads](packages/mobile/README.md#pipeline-downloads) for details, and the [mobile package guide](packages/mobile/README.md) for setup and backup behavior.

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

### Build profiles

Store builds exclude restricted capabilities at build time. Direct desktop and Homebrew builds keep all features. See the [build profiles and store policy audit](docs/build-profiles.md) for the capability matrix, build commands, and submission requirements.

```sh
npm run build:profile -- macos-homebrew package
npm run build:profile -- macos-app-store package
npm run build:profile -- ios-app-store sync
npm run build:profile -- android-google-play sync
```

### Desktop (Electron)

To package the application for your current platform:

```bash
npm run build:package
```

To create distributables (e.g., .deb, .exe, .zip):

```bash
npm run make
```

#### Installing the DMG locally (macOS)

With a Developer ID Application certificate of the pinned team in your keychain, the build is signed with it. Without one
it is ad-hoc signed, which satisfies Apple Silicon's code-signing requirement. Neither is notarized, which only matters for
a copy that was downloaded: clear its quarantine flag before the first launch.

```bash
npm run make -- --platform=darwin

xattr -dr com.apple.quarantine out/make/writeme.dmg
```

Open the DMG and drag **writeme** to `/Applications`.

> **Distributing to other machines** needs a notarized build. See [macOS releases and signing](PUBLISH.md#macos-releases-and-signing).

### Web / PWA

To build the web version and generate PWA assets:

```bash
npm run pwa:build
```

#### Vercel deployments

Automatic Git deployments are enabled only for `main`, after pull requests are merged.
The [web editor configuration](vercel.json) and [landing configuration](packages/landing/vercel.json)
disable every branch with `**` and explicitly enable `main`, so feature branches and pull requests
do not create preview deployments. Keep `main` as the Production Branch in both Vercel projects.
GitHub Actions PR checks still run; manual Vercel deployments are not changed by this policy.

## Testing

Select a platform and suite through the shared Playwright runner:

```sh
npm run test:e2e -- --platform osx --suite browser tests/e2e/data-safety.spec.ts --project chromium
npm run test:e2e -- --platform osx --suite production --project desktop-macos
npm run test:e2e -- --platform osx --suite native
```

See [platform suites, test coverage, and build reuse](docs/testing/platform-playwright.md) for all five platform configs, mobile/physical-device boundaries, and independent MCP package verification.

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
