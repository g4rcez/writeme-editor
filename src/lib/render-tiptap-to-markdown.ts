import type { Extensions, JSONContent, MarkType, NodeType } from "@tiptap/core";
import type { Mark, Node } from "@tiptap/pm/model";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";

export type NodeProps<TNodeType = any, TChildren = any> = {
  node: TNodeType;
  parent?: TNodeType;
  children?: TChildren;
  renderElement: (props: {
    content: TNodeType;
    parent?: TNodeType;
  }) => TChildren;
};

export type MarkProps<TMarkType = any, TChildren = any, TNodeType = any> = {
  mark: TMarkType;
  children?: TChildren;
  node: TNodeType;
  parent?: TNodeType;
};

export type TiptapStaticRendererOptions<
  TReturnType,
  TMarkType extends { type: any } = MarkType,
  TNodeType extends {
    content?: { forEach: (cb: (node: TNodeType) => void) => void };
    marks?: readonly TMarkType[];
    type: string | { name: string };
  } = NodeType,
  TNodeRender extends (
    ctx: NodeProps<TNodeType, TReturnType | TReturnType[]>,
  ) => TReturnType = (
    ctx: NodeProps<TNodeType, TReturnType | TReturnType[]>,
  ) => TReturnType,
  TMarkRender extends (
    ctx: MarkProps<TMarkType, TReturnType | TReturnType[], TNodeType>,
  ) => TReturnType = (
    ctx: MarkProps<TMarkType, TReturnType | TReturnType[], TNodeType>,
  ) => TReturnType,
> = {
  nodeMapping: Record<string, NoInfer<TNodeRender>>;
  markMapping: Record<string, NoInfer<TMarkRender>>;
  unhandledNode?: NoInfer<TNodeRender>;
  unhandledMark?: NoInfer<TMarkRender>;
};

export function TiptapStaticRenderer<
  TReturnType,
  TMarkType extends { type: string | { name: string } } = MarkType,
  TNodeType extends {
    content?: { forEach: (cb: (node: TNodeType) => void) => void };
    marks?: readonly TMarkType[];
    type: string | { name: string };
  } = NodeType,
  TNodeRender extends (
    ctx: NodeProps<TNodeType, TReturnType | TReturnType[]>,
  ) => TReturnType = (
    ctx: NodeProps<TNodeType, TReturnType | TReturnType[]>,
  ) => TReturnType,
  TMarkRender extends (
    ctx: MarkProps<TMarkType, TReturnType | TReturnType[], TNodeType>,
  ) => TReturnType = (
    ctx: MarkProps<TMarkType, TReturnType | TReturnType[], TNodeType>,
  ) => TReturnType,
>(
  renderComponent: (
    ctx:
      | {
        component: TNodeRender;
        props: NodeProps<TNodeType, TReturnType | TReturnType[]>;
      }
      | {
        component: TMarkRender;
        props: MarkProps<TMarkType, TReturnType | TReturnType[], TNodeType>;
      },
  ) => TReturnType,
  {
    nodeMapping,
    markMapping,
    unhandledNode,
    unhandledMark,
  }: TiptapStaticRendererOptions<
    TReturnType,
    TMarkType,
    TNodeType,
    TNodeRender,
    TMarkRender
  >,
) {
  return function renderContent({
    content,
    parent,
  }: {
    content: TNodeType;
    parent?: TNodeType;
  }): TReturnType {
    const nodeType =
      typeof content.type === "string" ? content.type : content.type.name;
    const NodeHandler = nodeMapping[nodeType] ?? unhandledNode;

    if (!NodeHandler) {
      throw new Error(`missing handler for node type ${nodeType}`);
    }
    const nodeContent = renderComponent({
      component: NodeHandler,
      props: {
        node: content,
        parent,
        renderElement: renderContent,
        // Lazily compute the children to avoid unnecessary recursion
        get children() {
          // recursively render child content nodes
          const children: TReturnType[] = [];

          if (content.content) {
            content.content.forEach((child) => {
              children.push(
                renderContent({
                  content: child,
                  parent: content,
                }),
              );
            });
          }

          return children;
        },
      },
    });

    // apply marks to the content
    const markedContent = content.marks
      ? content.marks.reduce((acc, mark) => {
        const markType =
          typeof mark.type === "string" ? mark.type : mark.type.name;
        const MarkHandler = markMapping[markType] ?? unhandledMark;

        if (!MarkHandler) {
          throw new Error(`missing handler for mark type ${markType}`);
        }

        return renderComponent({
          component: MarkHandler,
          props: {
            mark,
            parent,
            node: content,
            children: acc,
          },
        });
      }, nodeContent)
      : nodeContent;

    return markedContent;
  };
}

export function tiptapToMarkdown({
  content,
  extensions,
}: {
  content: Node | JSONContent;
  extensions: Extensions;
  options?: Partial<TiptapStaticRendererOptions<string, Mark, Node>>;
}) {
  const result = renderToHTMLString({ content, extensions });
  return result;
}
