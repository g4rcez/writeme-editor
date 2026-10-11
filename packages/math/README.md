# @writeme.dev/math

Math and date expression evaluation for Node.js, Bun, and Deno. This package ships ESM JavaScript and TypeScript declarations. It does not need Electron or a browser.

## Use

Node.js or Bun:

```sh
npm install @writeme.dev/math
# or: bun add @writeme.dev/math
```

```ts
import { evaluateInlineMath } from "@writeme.dev/math";

console.log(evaluateInlineMath("1 + 1"));
// { ok: true, value: "2" }
```

Deno:

```ts
import { evaluateInlineMath } from "npm:@writeme.dev/math";

console.log(evaluateInlineMath("1 + 1"));
```

Additional entry points:

- `@writeme.dev/math/dates`: `Dates` expression helpers.
- `@writeme.dev/math/mathjs-extensions`: mathjs instance and unit helpers.

CommonJS `require` is not provided. Expressions are evaluated locally; currency conversion needs caller-supplied exchange rates.

## Develop

Manage this directory independently:

```sh
npm ci --workspaces=false
npm run validate --workspaces=false
npm publish --workspaces=false --access public
```

`prepublishOnly` automatically validates the build, source/test types, unit tests, all three runtimes, and isolated tarball installation. All three runtimes must be on PATH. `prepack` only builds, which prevents recursive validation during installation tests.

From the repository root:

```sh
npm run build --workspace @writeme.dev/math
npm run typecheck --workspace @writeme.dev/math
npm test --workspace @writeme.dev/math
npm run test:runtime --workspace @writeme.dev/math
npm run test:package --workspace @writeme.dev/math
```

Runtime tests require Node.js, Bun, and Deno on PATH and run the compiled output. Tested with Node.js 24.18, Bun 1.3.14, and Deno 2.4.5. Node.js must be at least 22.13.

Unit tests cover classification, evaluation, inline expressions, dates, and proportions. Installation tests build and pack this package, install it into a temporary project, and verify all export paths and strict TypeScript declarations. They also execute the installed package in each runtime, including Deno's `npm:` imports.

See [publishing](../README.md) for the release sequence.
