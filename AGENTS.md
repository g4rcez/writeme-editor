# [AGENTS.md](http://AGENTS.md)

Agent guidelines for the Writeme Electron application.

## Build/Lint/Test Commands

**Package manager**: Use `npm` — not `pnpm` or `yarn`.

- `npm run dev` / `npm start` - Start Electron app in development mode
- `npm run browser:dev` - Start web version with Vite dev server
- `npm run typecheck` - Run TypeScript typecheck
- `npm run build:package` - Package application for distribution
- `npm run make` - Build distributables using Electron Forge
- `npm run pwa:dev` - Generate PWA assets and start browser dev
- `npm run test` - Run unit tests (Vitest)
- `npm run test:e2e -- --platform <windows|ios|osx|linux|android> --suite <browser|production|native|landing|profiles|mobile|device>` - Run platform-selected Playwright tests; see `docs/testing/platform-playwright.md`

## Feature Verification

- Test feature behavior with Playwright (`npm run test:e2e -- --platform <platform> --suite <suite>`), not interactive browser automation. Add or update relevant Playwright tests and run them for feature changes.

## Pull Requests

- Include at least one screenshot and a short video in every PR, showing the changed feature in use.
- Deliver repository changes through a pull request. Do not push changes directly to `main`.
- Run the complete fast PR gate for every pull request and every new commit: shared checks, all Linux Chromium browser regressions in shards, and the current Linux MCP contract. See `docs/testing/platform-playwright.md` for the five-minute execution target.
- Merge only when every required PR check succeeds for the latest commit and the branch is up to date with `main`. Full native/mobile/cross-platform builds and integrations run nightly and must pass for the release commit before publishing.
- Treat pending, failed, cancelled, skipped, missing, and stale checks as blockers. Never bypass required checks or use an administrator override.
- Homebrew publishing is a release step and is excluded from PR checks.
- Add tests to the existing suites; do not append feature-specific workflow steps or filename allowlists. Use production naming/tags for tests that require the built preview.

## Code Style Guidelines

- **TypeScript**: Strict typing with `noImplicitAny` enabled
- **Imports**: Use ESM imports, group by external/internal with blank lines
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **Types**: Explicit return types for functions, use `type` over `interface`
- **React**: Functional components with hooks, TSX extension required
- **Store**: Use `use-typed-reducer` pattern with typed dispatchers
- **Database**: Dexie.js repositories in `src/store/repositories/dexie/`
- **Styling**: Tailwind CSS with `clsx` utility, theme via CSS classes. **Never use raw Tailwind palette colors** (`bg-violet-600`, `text-white`, `bg-zinc-700`, etc.) — always use design system tokens from `@g4rcez/components` (e.g. `bg-button-primary-bg`, `text-button-primary-text`, `bg-secondary-background`, `text-foreground`). Raw colors break non-default themes. See `LESSONS.md` for the full token reference and contrast traps.
- **File Structure**: Feature-based organization under `src/app/`
- **Extensions**: `.tsx` for React components, `.ts` for utilities/types
- **Error Handling**: Use try-catch blocks with proper error types
- **IPC**: Type-safe communication between main/renderer processes
- **Comments**: Avoid unless absolutely necessary for complex logic
