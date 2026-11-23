import { defineConfig } from "oxlint";
import nkzw from '@nkzw/oxlint-config';

/**
 * Lint ratchet: rules that still have findings, with the count at adoption (2026-11-23).
 * Fix the findings, then delete the line so the rule turns on. Never add a line here.
 */
const ratchet = {
    "typescript/no-explicit-any": "off", // 364
    "typescript/no-unnecessary-condition": "off", // 287
    "typescript/no-floating-promises": "off", // 226
    "typescript/unbound-method": "off", // 125
    "quality/no-known-value-widening": "off", // 113
    "quality/no-unsafe-dictionary-type": "off", // 99
    "typescript/no-misused-spread": "off", // 88
    "unicorn/consistent-function-scoping": "off", // 81
    "@nkzw/no-instanceof": "off", // 74
    "react/set-state-in-effect": "off", // 58
    "jsx-a11y/prefer-tag-over-role": "off", // 46
    "quality/no-chained-type-assertions": "off", // 43
    "react-hooks/exhaustive-deps": "off", // 36
    "typescript/await-thenable": "off", // 31
    "quality/no-unknown-returns": "off", // 29
    "react/refs": "off", // 29
    "vitest/require-to-throw-message": "off", // 26
    "typescript/no-base-to-string": "off", // 23
    "unicorn/prefer-string-slice": "off", // 22
    "jsx-a11y/no-autofocus": "off", // 20
    "quality/no-conditional-empty-object-spread": "off", // 17
    "quality/no-array-filter-map": "off", // 15
    "vitest/valid-expect": "off", // 13
    "vitest/no-conditional-expect": "off", // 12
    "import/no-namespace": "off", // 9
    "typescript/restrict-template-expressions": "off", // 9
    "jsx-a11y/click-events-have-key-events": "off", // 8
    "jsx-a11y/no-static-element-interactions": "off", // 7
    "react/no-unescaped-entities": "off", // 7
    "typescript/no-empty-object-type": "off", // 6
    "jsx-a11y/label-has-associated-control": "off", // 5
    "typescript/prefer-optional-chain": "off", // 5
    "jsx-a11y/no-noninteractive-element-to-interactive-role": "off", // 4
    "quality/no-reflect-get": "off", // 4
    "jsx-a11y/no-noninteractive-tabindex": "off", // 4
    "eslint/no-control-regex": "off", // 4
    "jsx-a11y/no-noninteractive-element-interactions": "off", // 4
    "eslint/prefer-const": "off", // 3
    "jsx-a11y/aria-activedescendant-has-tabindex": "off", // 3
    "quality/no-object-parameters": "off", // 3
    "react/purity": "off", // 3
    "unicorn/prefer-top-level-await": "off", // 3
    "jsx-a11y/role-has-required-aria-props": "off", // 2
    "unicorn/no-new-array": "off", // 2
    "eslint/no-case-declarations": "off", // 2
    "oxc/no-accumulating-spread": "off", // 2
    "react/immutability": "off", // 2
    "vitest/expect-expect": "off", // 2
    "eslint/no-unused-vars": "off", // 2
    "typescript/no-implied-eval": "off", // 2
    "eslint/eqeqeq": "off", // 1
    "unicorn/no-useless-spread": "off", // 1
    "eslint/no-useless-assignment": "off", // 1
    "eslint/no-misleading-character-class": "off", // 1
    "eslint/no-eval": "off", // 1
    "jsx-a11y/media-has-caption": "off", // 1
    "typescript/no-this-alias": "off", // 1
    "eslint/array-callback-return": "off", // 1
    "import/default": "off", // 1
    "eslint/require-yield": "off", // 1
    "oxc/only-used-in-recursion": "off", // 1
    "vitest/valid-title": "off", // 1
    "vitest/no-standalone-expect": "off", // 1
    "jsx-a11y/control-has-associated-label": "off", // 1
    "unicorn/prefer-optional-catch-binding": "off", // 1
    "eslint/no-empty": "off", // 1
    "unicorn/no-single-promise-in-promise-methods": "off", // 1
    "unicorn/prefer-structured-clone": "off", // 1
    "react/incompatible-library": "off", // 1
    "typescript/no-redundant-type-constituents": "off", // 1
} as const;

export default defineConfig({
    extends: [nkzw],
    plugins: ["import", "jsx-a11y", "node", "oxc", "react", "react-perf", "typescript"],
    env: {
        ...nkzw.env,
        browser: true,
        node: true,
    },
    categories: {
        correctness: "warn",
        nursery: "warn",
    },
    rules: {
        "eslint/no-unused-vars": "error",
        // Autofix swaps appendChild for append, which returns void and breaks callers that use the returned node.
        "unicorn/prefer-dom-node-append": "off",
        // Undeclared globals (window, __WRITEME_BUILD__) throw a ReferenceError without typeof, so they are not checked.
        "unicorn/no-typeof-undefined": ["error", { checkGlobalVariables: false }],
        // Logging via console.warn/console.error stays. console.log/debug is leftover debugging.
        "eslint/no-console": ["error", { allow: ["warn", "error"] }],
    },
    overrides: [
        {
            // CLIs, build scripts and the dev proxy print to stdout on purpose.
            files: ["packages/cli/**", "packages/mcp/**", "scripts/**", "packages/*/scripts/**", "packages/*/tests/**", "tests/**", "packages/editor/src/server/proxy.ts"],
            rules: { "eslint/no-console": "off" },
        },
        {
            // Test doubles often mock <button type={type}> and loosely typed vi.fn().
            files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/test/**", "**/tests/**"],
            rules: { "react/button-has-type": "off", "vitest/require-mock-type-parameters": "off" },
        },
        { files: ["**/*"], rules: { ...ratchet } },
    ],
});
