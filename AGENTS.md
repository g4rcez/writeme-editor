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
- `npm run test:e2e` - Run e2e tests (Playwright)

## Feature Verification

- Test feature behavior with Playwright (`npm run test:e2e`), not interactive browser automation. Add or update relevant Playwright tests and run them for feature changes.

## Pull Requests

- Deliver repository changes through a pull request. Do not push changes directly to `main`.
- Run the full PR checks for every pull request and every new commit on it.
- Merge only when every build and verification job succeeds for the latest commit and the branch is up to date with `main`.
- Treat pending, failed, cancelled, skipped, missing, and stale checks as blockers. Never bypass required checks or use an administrator override.
- Homebrew publishing is a release step and is excluded from PR checks.

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
