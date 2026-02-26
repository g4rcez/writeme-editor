import { innerUrl } from "@/lib/encoding";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { ComponentType, ReactNode } from "react";

export type LinkRendererProps = {
  href: string;
  title?: string;
  className?: string;
  children: ReactNode;
};

export type LinkRenderer = ComponentType<LinkRendererProps>;

const DefaultLink = ({
  href,
  title,
  className,
  children,
}: LinkRendererProps) => (
  <a href={href} title={title} className={className}>
    {children}
  </a>
);

export const MentionNodeView = (props: NodeViewProps) => {
  const { id, label, path } = props.node.attrs;
  const href = (path as string) ?? innerUrl(`/note/${id}`, "mention");
  const LinkComp: LinkRenderer =
    props.extension.options.linkRenderer ?? DefaultLink;
  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      data-type="mention"
      data-id={id}
      data-label={label}
      data-path={href}
      className="mention"
    >
      <LinkComp href={href} title={`writeme-mention:${id}`} className="mention">
        {label ?? id}
      </LinkComp>
    </NodeViewWrapper>
  );
};
