import { innerUrl } from "@/lib/encoding";
import { getEditorAllNotes } from "@/lib/editor-storage";
import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { type ComponentType, type ReactNode } from "react";

import {
  createNoteLinkPreview,
  LinkPreview,
  NoteMentionPreview,
} from "./link-preview";

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
  const id = getStringAttribute(props.node.attrs.id);
  const label = getStringAttribute(props.node.attrs.label);
  const path = getStringAttribute(props.node.attrs.path);
  const href = path || innerUrl(`/note/${id}`, "mention");
  const title = label || id;
  const notes = getEditorAllNotes(props.editor);
  const preview = createNoteLinkPreview(
    notes,
    { id, label, path: href },
    title,
  );
  const LinkComp: LinkRenderer =
    props.extension.options.linkRenderer ?? DefaultLink;
  const trigger = (
    <LinkComp href={href} title={`writeme-mention:${id}`} className="mention">
      {title}
    </LinkComp>
  );

  return (
    <NodeViewWrapper
      as="span"
      data-id={id}
      data-path={href}
      data-label={label}
      data-link-text={title}
      data-link-url={href}
      className="mention-node"
      data-type="mention"
      contentEditable={false}
    >
      <LinkPreview trigger={trigger}>
        <NoteMentionPreview preview={preview} />
      </LinkPreview>
    </NodeViewWrapper>
  );
};

const getStringAttribute = (value: unknown): string => {
  return typeof value === "string" ? value : "";
};
