import { type BundledLanguage } from "shiki";

export interface ExecutionConfig {
  command: string;
  args?: string[];
  label: string;
}

export const EXECUTION_CONFIG: Partial<
  Record<BundledLanguage, ExecutionConfig>
> = {
  javascript: {
    command: "node",
    label: "Node.js",
  },
  typescript: {
    command: "ts-node",
    label: "TypeScript (ts-node)",
  },
  python: {
    command: "python3",
    label: "Python 3",
  },
  ruby: {
    command: "ruby",
    label: "Ruby",
  },
  go: {
    command: "go",
    args: ["run"],
    label: "Go",
  },
  rust: {
    command: "rust-script",
    label: "Rust Script",
  },
  bash: {
    command: "bash",
    label: "Bash",
  },
  sh: {
    command: "sh",
    label: "Shell",
  },
  zsh: {
    command: "zsh",
    label: "Zsh",
  },
};
