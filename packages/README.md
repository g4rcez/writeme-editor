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

You need access to the `writeme.dev` npm organization. Each package has its own version and validation hook.

From the repository root, release one package with npm's version argument:

```sh
pnpm release cli minor
pnpm release math patch
pnpm release mcp 0.2.0
pnpm release math prerelease --preid beta --tag next
pnpm release cli minor --dry-run
```

The same script works through `npm run release -- cli minor`. pnpm is only the script launcher; versioning and publishing use npm. The selected package must be public and have release validation. Validation runs before `npm version`, then `npm publish` runs its `prepublishOnly` checks against the new version. npm updates the selected manifest and its local lockfile without creating a Git commit or tag. Other package versions and dependency ranges are unchanged.

Supported version arguments are `major`, `minor`, `patch`, `premajor`, `preminor`, `prepatch`, `prerelease`, `from-git`, or an exact version. `--preid` and `--allow-same-version` are forwarded to npm version. Prereleases publish with the `next` tag by default; `--tag` overrides it. `--dry-run` validates and previews the commands without bumping or publishing. If publication fails after the version update, retry `npm publish` from that package directory.

Publish math first so the CLI dependency is available:

```sh
npm publish --workspace @writeme.dev/math --access public
npm publish --workspace @writeme.dev/cli --access public
```

`test:packages:independent` copies each public package outside the repository, installs its own dependencies, and runs `npm publish --dry-run` through the real hook. It also verifies that broken source blocks publication. CLI uses the copied math tarball for its first-release check. No package is published by validation, tests, builds, or dry runs.
