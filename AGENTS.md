# AGENTS.md

Agent guidelines for the Writeme Electron application.

## Build/Lint/Test Commands
- `npm run dev` / `npm start` - Start Electron app in development mode  
- `npm run browser:dev` - Start web version with Vite dev server
- `npm run lint` - Run ESLint on TypeScript/TSX files
- `npm run package` - Package application for distribution
- `npm run make` - Build distributables using Electron Forge
- `npm run pwa:dev` - Generate PWA assets and start browser dev
- No test framework configured - verify changes through manual testing

## Code Style Guidelines
- **TypeScript**: Strict typing with `noImplicitAny` enabled
- **Imports**: Use ESM imports, group by external/internal with blank lines
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **Types**: Explicit return types for functions, use `type` over `interface`
- **React**: Functional components with hooks, TSX extension required
- **Store**: Use `use-typed-reducer` pattern with typed dispatchers
- **Database**: Dexie.js repositories in `src/store/repositories/dexie/`
- **Styling**: Tailwind CSS with `clsx` utility, theme via CSS classes
- **File Structure**: Feature-based organization under `src/app/`
- **Extensions**: `.tsx` for React components, `.ts` for utilities/types
- **Error Handling**: Use try-catch blocks with proper error types
- **IPC**: Type-safe communication between main/renderer processes
- **Comments**: Avoid unless absolutely necessary for complex logic