import { defineConfig } from "oxfmt"

export default defineConfig({
  endOfLine: "lf",
  semi: false,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "es5",
  printWidth: 80,
  sortTailwindcss: {
    stylesheet: "app/globals.css",
    functions: ["cn", "cva"],
  },
  ignorePatterns: [
    "dist/",
    "node_modules/",
    ".next/",
    ".turbo/",
    "coverage/",
    "pnpm-lock.yaml",
    ".pnpm-store/",
  ],
})
