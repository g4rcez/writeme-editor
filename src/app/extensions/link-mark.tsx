import { Mark, mergeAttributes, type MarkViewProps } from "@tiptap/core";
import { MarkViewContent, ReactMarkViewRenderer } from "@tiptap/react";

import { LinkPreview, UrlLinkPreview } from "@/app/elements/link-preview";

type LinkMarkOptions = {
  HTMLAttributes: Record<string, string>;
};

const getStringAttribute = (value: unknown): string =>
  typeof value === "string" ? value : "";

const hasCustomLabel = (element: HTMLElement, href: string): boolean => {
  const label = element.textContent?.trim() ?? "";
  return Boolean(label && label !== href.trim());
};

function LinkMarkView({ mark, HTMLAttributes }: MarkViewProps) {
  const href = getStringAttribute(mark.attrs.href);
  const title = getStringAttribute(mark.attrs.title) || href;
  if (!href) return <MarkViewContent />;
  const linkAttributes = mergeAttributes(HTMLAttributes, {
    href,
    title,
    "data-link-url": href,
  });

  return (
    <LinkPreview
      trigger={
        <a {...linkAttributes}>
          <MarkViewContent />
        </a>
      }
    >
      <UrlLinkPreview title={title} url={href} />
    </LinkPreview>
  );
}

export const LinkMark = Mark.create<LinkMarkOptions>({
  name: "link",
  priority: 40,
  inclusive: false,
  addOptions() {
    return {
      HTMLAttributes: {
        class: "link",
        target: "_blank",
        rel: "noopener noreferrer",
      },
    };
  },
  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute("href"),
        renderHTML: (attributes) => {
          if (!attributes.href) return {};
          return { href: attributes.href };
        },
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute("title"),
        renderHTML: (attributes) => {
          if (!attributes.title) return {};
          return { title: attributes.title };
        },
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "a[href]",
        priority: 40,
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false;
          if (element.getAttribute("data-type") === "mention") return false;
          const href = element.getAttribute("href");
          if (!href || !hasCustomLabel(element, href)) return false;
          return null;
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const href = getStringAttribute(HTMLAttributes.href);
    const title = getStringAttribute(HTMLAttributes.title) || href;
    const hoverAttributes = href ? { title, "data-link-url": href } : {};
    return [
      "a",
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        hoverAttributes,
      ),
      0,
    ];
  },
  addMarkView() {
    return ReactMarkViewRenderer(LinkMarkView);
  },
});
