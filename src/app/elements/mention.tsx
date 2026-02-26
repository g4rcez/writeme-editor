import { innerUrl } from "@/lib/encoding";
import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { type ComponentType, type ReactNode } from "react";

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
  <a
    data-component="default-link"
    href={href}
    title={title}
    className={className}
  >
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
      data-id={id}
      data-path={href}
      data-label={label}
      className="mention"
      data-type="mention"
      contentEditable={false}
    >
      <LinkComp href={href} title={`writeme-mention:${id}`} className="mention">
        {label ?? id}
      </LinkComp>
    </NodeViewWrapper>
  );
};
