# Dependency and bundle audit

## Recommendation

Optimize the existing loading boundaries before removing libraries. Most unused direct dependency declarations do not contribute browser JavaScript. Removing them can reduce installation and packaging work, but it is not proof of smaller browser assets.

This is a read-only source audit. No manifest, lockfile, dependency, or application code was changed. Root `package.json` and `package-lock.json` already had working-tree changes.

## Scope and baseline

Reviewed root `package.json` and manifests in `packages/editor`, `packages/landing`, `packages/cli`, and `packages/solver`; source import references; selected package dependency/peer metadata; offline npm ownership reports; and existing production `dist` assets. No fresh dependency-audit build, native packaging, runtime network trace, or test suite was run.

Sizes below are byte lengths of existing output and deterministic gzip sizes of individual assets, not measured HTTP transfers or predicted savings. Decimal MB are used.

The initial scripts and module-preload links in `dist/index.html` name **34 unique JavaScript assets: 28,610,739 bytes raw / 7,215,733 bytes gzip**. This excludes further dynamic imports, styles, fonts, and images.

| Existing chunk |  Raw bytes | Gzip bytes |
| -------------- | ---------: | ---------: |
| Shiki          | 10,076,037 |  1,692,961 |
| Logos          |  7,534,456 |  2,736,832 |
| Excalidraw     |  4,058,640 |  1,393,779 |
| Code block     |  3,631,457 |    996,035 |
| Index          |  3,466,212 |    980,554 |
| Mermaid        |  3,419,138 |    908,650 |
| Graphviz       |  2,246,983 |    740,993 |
| Chat page      |  1,107,135 |    347,011 |

These chunks overlap the initial-asset total; do not add both tables together. Chunk names indicate grouping, not exclusive dependency ownership.

There are also **109 source-map files totaling 79,379,909 bytes** in `dist`. Source maps normally do not affect application HTTP transfers, but can increase a release/archive size if shipped. Native package inclusion was not verified.

## Prioritized findings

### 1. Separate Shiki core/metadata from language and theme payloads

- **Impact:** high potential reduction in initial JavaScript loading and parsing; total distribution reduction is not established.
- **Effort:** medium. **Risk:** medium. **Confidence:** high in the measured chunk/preload problem; medium in the exact bundler remedy.
- **Evidence:** `dist/index.html` preloads the 10.08 MB Shiki chunk. `packages/editor/src/app/elements/code-block.tsx` imports `bundledLanguages`, `bundledThemes`, and `createHighlighter` from the full `shiki` entry. Its `loadHighlighter` already requests selected languages and two Catppuccin themes, rather than all languages. Other imports include language-picker and extension metadata consumers.
- **Fix sketch:** inspect `vite.config.ts` manual chunk ownership and the emitted module graph. Preserve dynamic language/theme boundaries; use metadata-only or core entry points where appropriate. Keep the custom math grammar and all supported languages. Do not implement a second lazy-loading framework around behavior that is already lazy.
- **Verification:** compare initial HTML-linked assets and all emitted JS before/after. Check highlighting, theme changes, language switching, frontmatter, custom math, and cold offline use. Splitting can increase total compressed bytes even when initial loading improves.

### 2. Load Prettier plugins when formatting is requested

- **Impact:** likely reduction in code-block feature loading; exact attribution and savings need a build comparison.
- **Effort:** small to medium. **Risk:** low to medium. **Confidence:** high in eager imports; medium in measured savings.
- **Evidence:** `packages/editor/src/app/elements/code-block-formatting.ts` statically imports Babel, Estree, HTML, Markdown, PostCSS, TypeScript, YAML, and the standalone formatter. `formatCode` already returns a promise, providing a natural asynchronous boundary.
- **Fix sketch:** retain the existing language/parser mapping and `canFormat` behavior, but import the formatter and required plugin combination inside formatting. Keep embedded-language requirements, error behavior, and concurrent calls correct.
- **Verification:** focused formatting tests for every existing supported parser, invalid syntax, embedded languages, and repeated/concurrent formatting; then compare code-block chunks and overall JS. Do not remove Prettier: it is a product dependency, not merely a development formatter.

### 3. Audit diagram preload ownership and PWA installation costs

- **Impact:** high potential startup savings; offline installation cost remains unless its contract changes.
- **Effort:** medium. **Risk:** medium to high. **Confidence:** high in preload/precache evidence.
- **Evidence:** initial HTML preloads Excalidraw, Mermaid, and Graphviz. `packages/editor/src/app/elements/code-block/mermaid.tsx` already registers a dynamic `@iconify-json/logos` loader. Generated `dist/sw.js` precaches both the logos and Shiki assets.
- **Fix sketch:** identify imports/shared chunk rules that pull optional renderers into the initial graph. Keep editor node registration separate from expensive rendering where feasible. The logos pack is already lazy for application execution; another dynamic wrapper will not fix its distribution or precache size.
- **Approval gate:** do not change eager precaching to on-demand caching, reduce icon coverage, or remove a renderer without an explicit decision about first-use offline behavior. These are feature changes, not harmless dependency cleanup.
- **Verification:** initial asset list, diagram rendering, error states, theme switching, icon diagrams, and cold/warm offline tests. Measure precache bytes separately from initial document bytes.

### 4. Separate release source maps from public/shipped assets

- **Impact:** up to the measured 79.38 MB of current map files can be excluded from this browser release artifact; native savings remain unknown.
- **Effort:** small. **Risk:** medium. **Confidence:** high in current bytes, conditional on packaging/deployment policy.
- **Evidence:** existing `dist/**/*.map` files.
- **Fix sketch:** confirm debugging and crash-reporting requirements. Retain development maps and, if needed, store release maps privately rather than publishing/shipping them. A hidden source-map setting alone does not remove map files from an archive.
- **Verification:** inspect actual deployment and native archive contents, then test release error diagnostics. Do not claim application runtime byte savings from omitted maps.

## Manifest cleanup candidates

These are candidates for a separately approved cleanup, not a safe-uninstall list. The import scan does not prove absence of dynamic consumers, native lifecycle use, or user-script expectations.

| Current root declaration                                       | Recommendation                                         | Expected effect and caution                                                                                                                                                                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@tanstack/ai` 0.52.1                                          | Candidate removal                                      | No scanned app import; offline npm ownership shows a root direct requirement. May remove its otherwise-unused tree. Existing AI functionality uses other SDKs; verify that path before removal. No browser savings established. |
| `@tiptap/extension-superscript` 3.31.0                         | Candidate removal                                      | No scanned registration/import; npm ownership shows the root direct requirement. Verify extension configuration and stored-document compatibility first.                                                                        |
| `sidekicker` 1.0.0                                             | Candidate removal of root declaration                  | No scanned app import. `@g4rcez/components` still needs its separate 0.1.10 copy. Removing 1.0.0 does not remove the library from the application graph.                                                                        |
| `@git-diff-view/core`                                          | Remove redundant direct ownership only after approval  | `@git-diff-view/react` still requires it. Expect no elimination of the core library or its browser bytes. Keep the existing diff feature.                                                                                       |
| `@base-ui/react`, `class-variance-authority`, `tw-animate-css` | Review redundant root declarations                     | Direct scanned use is in landing, whose manifest declares them. The component library also owns Base UI and CVA. Preserve landing installs and builds; do not remove them globally.                                             |
| `@types/electron-squirrel-startup`, `@types/which`             | Consider moving root declarations to dev dependencies  | Type support may be implicit. Do not delete needed declarations. No browser JS reduction; possible production installation cleanup.                                                                                             |
| `vite-plugin-pwa` 1.3.0                                        | Consider moving to dev dependencies                    | Build/config tooling, but currently production-classified along with `workbox-build`. Preserve generated service-worker runtime and confirm the install/build/deploy sequence. Browser output need not change.                  |
| `node-abi` 4.35.0                                              | Review build/native lifecycle ownership; defer removal | No scanned direct app import; Electron rebuild tools also own other versions. Validate packaging and ABI tooling before changing root ownership.                                                                                |

### Keep despite apparent import absence

- **`@sinclair/typebox`:** Elysia declares it as a peer. Root import absence is not sufficient evidence for removal.
- **Landing `react-dom`:** framework ownership is sufficient; direct application imports are not required.
- **`@git-diff-view/core`:** still needed transitively by the current viewer.
- **Prettier, terminal packages, and `puppeteer-core`:** actual runtime source consumers exist. `puppeteer-core` is used by `ipc/read-it-later.ipc.ts`; terminal packages support the terminal panel and web backend. Browser-only import statistics must not decide native dependency removal.

## Remaining package scopes

- **Editor:** its manifest does not independently own the application's dependency set; root owns the relevant declarations.
- **Landing:** framework, UI, theming, class utilities, and CSS imports have consumers. `shadcn/tailwind.css` is imported, so the CLI-looking package is not automatically removable.
- **CLI:** `solver` and `zod` have consumers. Its separately compiled Bun executable needs a separate size baseline; browser chunk totals do not cover it.
- **Solver:** `chrono-node`, `date-fns`, and `mathjs` have consumers. Do not prune math functions or change parsing to obtain speculative savings. Version alignment requires an installed-tree and emitted-module check, then compatibility tests; do not force major-version deduplication with overrides.

## Bounded implementation handoff

1. Start with Shiki chunk ownership or Prettier demand loading, not bulk package removal. Capture a fresh production baseline tied to the current working tree. Preserve unrelated manifest/lockfile changes.
2. Change one loading boundary at a time. Keep public behavior, errors, themes, cancellation/ownership, and offline support. Do not add packages or update versions.
3. Run focused existing tests and active LSP diagnostics. Obtain approval for builds, native packaging, and end-to-end checks when not already authorized for that batch.
4. Compare all emitted JS/CSS, the initial script/preload set, precache assets, and map/archive sizes separately. Report actual raw/gzip bytes; do not present renamed chunks or source-line deletion as savings.
5. Before dependency cleanup, show the current declaration, reason, peer/transitive ownership, expected supply-chain change, and checks. Obtain approval. Recheck the current tree because both root dependency files were already modified.

Audit working data: `/tmp/writeme-dependency-import-audit.json` and `/tmp/writeme-dependency-explain.txt`. These are local scratch artifacts, not durable repository evidence or proof of runtime coverage.
