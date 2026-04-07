import { Editor } from "../../editor";

const content = `# >>table
You can insert a table using the \`>>table\` command with dimensions.

Try to type \`>>table(3x4)\` or \`>>table(3,4)\`

The first number is columns and the second is rows.
`;

export default function EditorPage() {
  return <Editor content={content} />;
}
