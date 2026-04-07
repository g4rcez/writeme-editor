import { Editor } from "../../editor";

const content = `# >>math
You can enable a math expression solver using \`>>math\` command.

Try to type \`>>math 10 * 10 =\`

- 
`

export default function EditorPage() {
  return <Editor content={content} />;
}
