import { Editor } from "../../editor";

const content = `# >>eval
You can execute JavaScript code directly in your editor using the \`>>eval\` command.

The eval command allows you to run JavaScript expressions and see their results inline. You can finish your code block with \`;\`

## Usage Examples

Try typing any of these commands:

- \`>>eval 2 + 2\` - Simple arithmetic
- \`>>eval Math.PI * 10\` - Using Math functions
- \`>>eval new Date().toISOString()\` - Current timestamp
- \`>>eval "Hello".toUpperCase()\` - String manipulation
- \`>>eval [1,2,3].map(x => x * 2)\` - Array operations
- \`>>eval JSON.stringify({name: "test", value: 42})\` - Object serialization

## Advanced Examples

- \`>>eval Math.random().toString(36).substring(7)\` - Random string
- \`>>eval Array.from({length: 5}, (_, i) => i + 1)\` - Generate array
- \`>>eval btoa("encode this")\` - Base64 encoding
- \`>>eval crypto.randomUUID()\` - Generate UUID (in supported browsers)

## Safety Note
Only evaluate trusted code. The eval command executes JavaScript in your browser environment.
`;

export default function EvalPage() {
  return <Editor content={content} />;
}
