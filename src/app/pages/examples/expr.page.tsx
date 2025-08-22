import { Editor } from "../../editor";

const content = `# >>expr
You can show Latex inline expressions using the \`>>expr\` command.

## Usage Examples

Try typing any of these commands:

### Basic Arithmetic
- \`>>expr 15 + 25\`
- \`>>expr 100 - 37\`
- \`>>expr 12 * 8\`
- \`>>expr 144 / 12\`
- \`>>expr 2 ^ 8\`

### Advanced Math
- \`>>expr \\sqrt(144)\` 
- \`>>expr \\abs(-42)\` 
- \`>>expr \\sin(pi/2)\` 

### Complex Expressions
- \`>>expr (5 + 3) * 2 - 1\` 
- \`>>expr 2^3 + \\sqrt(16) - 5\`
- \`>>expr \\sin(pi/6) + \\cos(pi/3)\`
- \`>>expr \\log(e^3)\`

### Constants
- \`>>expr \\pi\` 
- \`>>expr \\e\` 
- \`>>expr \\phi\` 
`;

export default function ExprPage() {
  return <Editor content={content} />;
}
