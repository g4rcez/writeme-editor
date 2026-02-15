import { Editor } from "../../editor";

const content = `# >>money
You can convert currencies using the \`>>money\` command.

Try to type 
\`>>money 100USD to EUR =\`

It supports common currency codes like USD, EUR, BRL, etc. Powered by [https://frankfurter.dev/](https://frankfurter.dev/)
`

export default function EditorPage() {
  return <Editor content={content} />;
}

