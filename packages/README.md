# Packages

Publishable npm packages:

| Directory | Package             |
| --------- | ------------------- |
| `math`    | `@writeme.dev/math` |
| `cli`     | `@writeme.dev/cli`  |
| `mcp`     | `@writeme.dev/mcp`  |

Other directories contain application targets, not new public npm packages.

## Independent management

Each public package owns its dependencies, compiler configuration, tests, and release validation. Its directory can be copied into a separate checkout without the editor or repository-level test helpers. Workspaces remain a convenience for application development.

From the selected package directory:

```sh
npm install --workspaces=false
npm run validate --workspaces=false
npm version patch --workspaces=false --git-tag-version=false
npm publish --workspaces=false --access public
```

`prepublishOnly` automatically runs `validate` before publication. Math and CLI validation builds the package, checks source and test types, and runs unit, runtime, and isolated installation tests. MCP also checks lint, formatting, contract drift, and its built protocol. Failed checks block publication. `prepack` only builds, so installation tests can pack without recursively running publication validation.

Math and MCP own standalone npm lockfiles and support `npm ci --workspaces=false`. The CLI's obsolete lockfile linked to sibling source; it has been removed. Generate a new standalone CLI lockfile with `npm install --workspaces=false` once math is available on npm.

Versions are independent. Change the CLI's math dependency range only when its compatibility requirements change; a math release does not require a CLI or MCP release.

## CLI before the first math publication

Until math is available on npm, bootstrap the CLI with a built tarball:

```sh
cd packages/math
npm ci --workspaces=false
npm pack --pack-destination /tmp --workspaces=false
cd ../cli
npm install --workspaces=false --no-save --package-lock=false /tmp/writeme.dev-math-1.0.0.tgz
npm run validate --workspaces=false
```

Use the filename produced by `npm pack` if the version changes. Bootstrap installs the CLI's dependencies without changing its public registry dependency range. CLI installation tests pack its installed math dependency, so they support both registry and local-tarball installations without importing sibling source.

Publish math first so ordinary CLI installations can resolve it. MCP has no dependency on math or CLI.

## Repository convenience commands

From the repository root, with workspace dependencies installed:

```sh
npm run build:packages
npm run typecheck --workspace @writeme.dev/math
npm run typecheck --workspace @writeme.dev/cli
npm run test:packages
npm run test:packages:runtime
npm run test:packages:pack
npm run test:packages:types
npm run validate:packages
npm run test:packages:independent
npm pack --dry-run --workspace @writeme.dev/math
npm pack --dry-run --workspace @writeme.dev/cli
```

Each package owns its unit, runtime, and installation tests. Runtime and installation tests require Node.js, Bun, and Deno.

Installation tests run `npm pack`, install the tarballs into temporary projects, and use those installed packages without repository aliases or workspace links. They check package contents, TypeScript declarations, executable installation, expressions, query filters, and failure cases across all three runtimes. The temporary projects and databases are removed after the tests. npm uses its cache when available and downloads missing dependencies; nothing is published.

## Publish

You need access to the `writeme.dev` npm organization. The repository command publishes all three public packages:

```sh
pnpm release patch
pnpm release minor
pnpm release major
pnpm release patch --dry-run
```

The script validates math, CLI, and MCP before changing any versions, then increments each package's own current version and publishes in dependency order: math, CLI, MCP. pnpm is the command launcher; npm performs versioning and publication, and each `prepublishOnly` hook validates again. `--dry-run` still runs validation but does not change versions or publish.

After publication, the updated package manifests and lockfiles remain in the working tree for review and commit through the normal pull-request workflow. A registry error can occur after an earlier package has published; the error identifies the remaining packages. Retry only those packages with `npm publish --workspaces=false --access public` from their package directories—do not bump the versions a second time.

`test:packages:independent` copies each public package outside the repository, installs its own dependencies, and runs `npm publish --dry-run` through the real hook. It also verifies that broken source blocks publication. CLI uses the copied math tarball for its first-release check. No package is published by validation, tests, builds, or dry runs.
