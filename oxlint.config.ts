import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["import", "jsx-a11y", "node", "oxc", "react", "react-perf", "react-perf", "typescript"],
  categories: {
    correctness: "warn",
    nursery: "warn",
  },
  rules: {
    "eslint/no-unused-vars": "error",
  },
});
