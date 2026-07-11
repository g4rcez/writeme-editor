import { defineConfig } from "oxlint";

export default defineConfig({
    plugins: ["import", "jsx-a11y", "node", "oxc", "react", "react-perf", "typescript"],
    env: {
        browser: true,
        node: true,
    },
    categories: {
        correctness: "warn",
        nursery: "warn",
    },
    rules: {
        "eslint/no-unused-vars": "error",
    },
});
