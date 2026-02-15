import { Editor } from "../../editor";

const content = `# >>draw
You can insert an Excalidraw diagram using the \`>>draw\` command.

Try to type >>draw (with a space at the end)
`

export default function EditorPage() {
  return <Editor content={content} />;
}

