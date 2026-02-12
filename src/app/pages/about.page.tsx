import { Editor } from "../editor";

const content = `
# About the project

A distraction-free writing environment that respects your privacy and keeps things beautifully simple.
### Simplicity

No accounts, no menus, no distractions. Just open and start writing. The clean interface keeps your focus on what matters most—your words.

### Markdown

Write in plain text with Markdown support. Headers, lists, and links format automatically as you type.

### Privacy first

Your writing never leaves your device. Everything saves locally in your browser—no servers, no tracking, no data collection. Just you and your thoughts.

### Source code

For now, the code is closed and you can only have access if you talk with the author: [https://github.com/g4rcez/](https://github.com/g4rcez/)
`;

export default function AboutPage() {
  return (
    <div className="h-full w-full">
      <Editor content={content} readonly={true} />
    </div>
  );
}
