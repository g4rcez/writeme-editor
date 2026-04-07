import { Editor } from "../../editor";

const content = `# >>copy
You can start listening to your clipboard and automatically paste content into the editor using the \`>>copy\` command.

Try to type \`>>copy \` (with a space at the end)

After that, everything you copy will be appended to this editor.
`;

export default function EditorPage() {
  return <Editor content={content} />;
}
