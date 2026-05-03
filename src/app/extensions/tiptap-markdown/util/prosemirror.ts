import type { Node } from "@tiptap/pm/model";

export function childNodes(node: Node): Node[] {
  return (node?.content as unknown as { content?: Node[] })?.content ?? [];
}
