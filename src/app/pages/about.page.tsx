import pkg from "../../../package.json";

type Dep = { name: string; description: string };

const DEPS: Dep[] = [
  { name: "@excalidraw/excalidraw", description: "Virtual whiteboard for hand-drawn-style diagrams" },
  { name: "@floating-ui/react", description: "Floating UI: tooltips, popovers, and dropdown anchoring" },
  { name: "@g4rcez/components", description: "Custom component library with Tailwind preset and theming" },
  { name: "@git-diff-view/core", description: "Core engine for rendering Git diff views" },
  { name: "@git-diff-view/react", description: "React component for displaying Git diff views" },
  { name: "@harshtalks/slash-tiptap", description: "Slash-command menu extension for Tiptap" },
  { name: "@iconify-json/logos", description: "Iconify JSON icon set for technology brand logos" },
  { name: "@phosphor-icons/react", description: "Flexible, open-source icon family for React" },
  { name: "@radix-ui/react-dropdown-menu", description: "Accessible, unstyled dropdown menu primitives" },
  { name: "@radix-ui/react-popover", description: "Accessible, unstyled popover primitives" },
  { name: "@tanstack/ai", description: "TanStack AI integration utilities" },
  { name: "@tanstack/ai-react", description: "TanStack AI React bindings and hooks" },
  { name: "@tanstack/react-query", description: "Powerful async state management and data fetching for React" },
  { name: "@tanstack/react-virtual", description: "Virtualized list and grid rendering for React" },
  { name: "@tiptap/core", description: "Framework-agnostic rich text editor built on ProseMirror" },
  { name: "@tiptap/extension-code-block", description: "Code block extension for Tiptap" },
  { name: "@tiptap/extension-code-block-lowlight", description: "Code block with lowlight syntax highlighting for Tiptap" },
  { name: "@tiptap/extension-color", description: "Text color extension for Tiptap" },
  { name: "@tiptap/extension-file-handler", description: "File drag-and-drop and paste handler for Tiptap" },
  { name: "@tiptap/extension-highlight", description: "Text highlight marker extension for Tiptap" },
  { name: "@tiptap/extension-horizontal-rule", description: "Horizontal rule (---) extension for Tiptap" },
  { name: "@tiptap/extension-image", description: "Image node extension for Tiptap" },
  { name: "@tiptap/extension-list", description: "Ordered and unordered list extension for Tiptap" },
  { name: "@tiptap/extension-mathematics", description: "LaTeX math rendering extension for Tiptap" },
  { name: "@tiptap/extension-mention", description: "@mention autocomplete extension for Tiptap" },
  { name: "@tiptap/extension-subscript", description: "Subscript text extension for Tiptap" },
  { name: "@tiptap/extension-superscript", description: "Superscript text extension for Tiptap" },
  { name: "@tiptap/extension-table", description: "Table editing extension for Tiptap" },
  { name: "@tiptap/extension-task-item", description: "Checkbox task item extension for Tiptap" },
  { name: "@tiptap/extension-task-list", description: "Task list (checklist) container extension for Tiptap" },
  { name: "@tiptap/extension-text-align", description: "Text alignment extension for Tiptap" },
  { name: "@tiptap/extension-typography", description: "Typographic smart-quotes and punctuation extension for Tiptap" },
  { name: "@tiptap/extension-unique-id", description: "Unique ID attribute extension for Tiptap nodes" },
  { name: "@tiptap/extensions", description: "Bundle of additional official Tiptap extensions" },
  { name: "@tiptap/html", description: "HTML serialization and parsing utilities for Tiptap" },
  { name: "@tiptap/markdown", description: "Markdown serialization and parsing for Tiptap" },
  { name: "@tiptap/pm", description: "ProseMirror re-exports for use in Tiptap extensions" },
  { name: "@tiptap/react", description: "React component and hooks for Tiptap editor" },
  { name: "@tiptap/starter-kit", description: "Collection of essential extensions bundled for Tiptap" },
  { name: "@tiptap/static-renderer", description: "Static (server-side) rendering for Tiptap nodes" },
  { name: "@types/diff", description: "TypeScript type definitions for the diff package" },
  { name: "@types/dompurify", description: "TypeScript type definitions for DOMPurify" },
  { name: "@types/electron-squirrel-startup", description: "TypeScript types for electron-squirrel-startup" },
  { name: "@types/uuid", description: "TypeScript type definitions for uuid" },
  { name: "@types/which", description: "TypeScript type definitions for which" },
  { name: "@typescript-eslint/eslint-plugin", description: "ESLint plugin with TypeScript-specific linting rules" },
  { name: "@typescript-eslint/parser", description: "TypeScript parser for ESLint" },
  { name: "ansi-to-html", description: "Convert ANSI escape codes to HTML color spans" },
  { name: "better-sqlite3", description: "Fast, synchronous SQLite3 library for Node.js" },
  { name: "chrono-node", description: "Natural language date and time parser" },
  { name: "class-variance-authority", description: "Type-safe variant builder for UI components (cva)" },
  { name: "clsx", description: "Utility for constructing conditional className strings" },
  { name: "date-fns", description: "Modern, functional JavaScript date utility library" },
  { name: "dexie", description: "Minimalistic, promise-based IndexedDB wrapper" },
  { name: "diff", description: "Text comparison library implementing the Myers diff algorithm" },
  { name: "dompurify", description: "Fast, XSS-safe HTML and SVG sanitizer" },
  { name: "eslint", description: "Pluggable JavaScript and TypeScript linter" },
  { name: "eslint-plugin-import", description: "ESLint rules for ES module import/export validation" },
  { name: "katex", description: "Fast browser-side LaTeX math rendering library" },
  { name: "marked", description: "Fast, compliant Markdown parser and compiler" },
  { name: "mathjs", description: "Extensive math library with expression parser for JavaScript" },
  { name: "mermaid", description: "Diagram and flowchart generation from Markdown-like text" },
  { name: "motion", description: "Production-ready animation library for React" },
  { name: "prettier", description: "Opinionated, zero-config code formatter" },
  { name: "radix-ui", description: "Collection of accessible, unstyled React UI primitives" },
  { name: "react", description: "Library for building reactive component-based UIs" },
  { name: "react-dom", description: "React renderer targeting the browser DOM" },
  { name: "react-force-graph-2d", description: "2D force-directed graph visualization React component" },
  { name: "react-hotkeys-hook", description: "React hook for declarative keyboard shortcut handling" },
  { name: "react-markdown", description: "Safe Markdown rendering as React components" },
  { name: "react-resizable-panels", description: "Drag-to-resize split panel layouts for React" },
  { name: "react-router-dom", description: "Declarative routing library for React web applications" },
  { name: "react-textarea-autosize", description: "Textarea that automatically grows to fit its content" },
  { name: "rehype-format", description: "Rehype plugin to format HTML output with indentation" },
  { name: "rehype-raw", description: "Rehype plugin to parse raw embedded HTML nodes" },
  { name: "rehype-sanitize", description: "Rehype plugin to sanitize HTML against XSS" },
  { name: "rehype-stringify", description: "Rehype plugin to serialize a syntax tree to an HTML string" },
  { name: "remark-directive", description: "Remark plugin to parse generic Markdown directives" },
  { name: "remark-frontmatter", description: "Remark plugin to parse YAML/TOML frontmatter blocks" },
  { name: "remark-gfm", description: "Remark plugin for GitHub Flavored Markdown (tables, strikethrough, etc.)" },
  { name: "remark-math", description: "Remark plugin to parse inline and block math expressions" },
  { name: "remark-parse", description: "Remark plugin to parse Markdown into a unified syntax tree" },
  { name: "remark-rehype", description: "Remark plugin to transform a Markdown tree into an HTML tree" },
  { name: "remark-stringify", description: "Remark plugin to serialize a Markdown syntax tree to string" },
  { name: "shiki", description: "Syntax highlighter using VS Code TextMate grammars and themes" },
  { name: "tailwind-merge", description: "Utility for merging conflicting Tailwind CSS class names" },
  { name: "tiptap-extension-code-block-shiki", description: "Shiki-based syntax highlighting for Tiptap code blocks" },
  { name: "tiptap-extension-global-drag-handle", description: "Global drag handle for reordering blocks in Tiptap" },
  { name: "tw-animate-css", description: "CSS animation utilities as Tailwind CSS classes" },
  { name: "unified", description: "Interface for processing content through syntax tree plugins" },
  { name: "unist-util-visit", description: "Utility to recursively visit nodes in unist syntax trees" },
  { name: "use-typed-reducer", description: "Typed reducer and global state management hook for React" },
  { name: "uuid", description: "RFC-compliant UUID generation library" },
  { name: "vite-plugin-pwa", description: "Vite plugin for Progressive Web App support (workbox)" },
  { name: "which", description: "Cross-platform implementation of the Unix `which` command" },
  { name: "yaml", description: "YAML 1.2 spec-compliant parser and stringifier" },
  { name: "zod", description: "TypeScript-first runtime schema declaration and validation" },
].sort((a, b) => a.name.localeCompare(b.name));

const deps = pkg.dependencies as Record<string, string>;

export default function AboutPage() {
  return (
    <div className="h-full w-full overflow-y-auto">
      <section className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-4 font-outfit text-3xl font-bold">About the project</h1>
        <p className="mb-8 text-neutral-600 dark:text-neutral-400">
          A distraction-free writing environment that respects your privacy and keeps things beautifully simple.
        </p>

        <h3 className="mb-2 font-outfit text-xl font-semibold">Simplicity</h3>
        <p className="mb-6 text-neutral-600 dark:text-neutral-400">
          No accounts, no menus, no distractions. Just open and start writing. The clean interface keeps your focus on
          what matters most—your words.
        </p>

        <h3 className="mb-2 font-outfit text-xl font-semibold">Markdown</h3>
        <p className="mb-6 text-neutral-600 dark:text-neutral-400">
          Write in plain text with Markdown support. Headers, lists, and links format automatically as you type.
        </p>

        <h3 className="mb-2 font-outfit text-xl font-semibold">Privacy first</h3>
        <p className="mb-6 text-neutral-600 dark:text-neutral-400">
          Your writing never leaves your device. Everything saves locally in your browser—no servers, no tracking, no
          data collection. Just you and your thoughts.
        </p>

        <h3 className="mb-2 font-outfit text-xl font-semibold">Source code</h3>
        <p className="text-neutral-600 dark:text-neutral-400">
          For now, the code is closed and you can only have access if you talk with the author:{" "}
          <a
            href="https://github.com/g4rcez/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline dark:text-blue-400"
          >
            https://github.com/g4rcez/
          </a>
        </p>
      </section>

      <section className="mx-auto max-w-2xl px-6 pb-16">
        <h2 className="mb-6 font-outfit text-2xl font-bold">Open source dependencies</h2>
        <ul className="space-y-3">
          {DEPS.map(({ name, description }) => (
            <li key={name} className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800/50">
              <div className="flex items-center gap-3">
                <a
                  href={`https://www.npmjs.com/package/${name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {name}
                </a>
                {deps[name] && (
                  <span className="rounded bg-neutral-200 px-1.5 py-0.5 font-mono text-xs text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400">
                    {deps[name]}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
