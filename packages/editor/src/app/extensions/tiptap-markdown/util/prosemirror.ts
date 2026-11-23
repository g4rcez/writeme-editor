import type { Node } from "@tiptap/pm/model";

export function childNodes(node: Node): Array<Node> {
    return (node?.content as unknown as { content?: Array<Node> })?.content ?? [];
}
