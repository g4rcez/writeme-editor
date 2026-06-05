import { LinkedinLogoIcon } from "@phosphor-icons/react";
import { GithubLogoIcon } from "@phosphor-icons/react/dist/csr/GithubLogo";
import { InstagramLogoIcon } from "@phosphor-icons/react/dist/csr/InstagramLogo";
import { LinkIcon } from "@phosphor-icons/react/dist/csr/Link";
import { TwitterLogoIcon } from "@phosphor-icons/react/dist/csr/TwitterLogo";
import { YoutubeLogoIcon } from "@phosphor-icons/react/dist/csr/YoutubeLogo";
import { Node, PasteRule, mergeAttributes, nodeInputRule } from "@tiptap/core";
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import type React from "react";
import { DomainLinkPreview, LinkPreview } from "@/app/elements/link-preview";

type MarkdownSerializerState = { write: (value: string) => void };

type MarkdownSerializerNode = {
  attrs: {
    href?: string | null;
    text?: string | null;
  };
};

export type DomainConfig = {
  regex: RegExp;
  icon: () => React.ReactNode;
  title: (match: RegExpMatchArray) => string;
};

type DomainLinkDisplayProps<
  As extends React.ElementType = React.ElementType<"a">,
> = { url: string; as?: As };

const commonClasses = "inline-flex items-center gap-1 link";
const externalHttpUrlRegex = /^https?:\/\/[^\s<>"')]+$/i;
const externalHttpPasteRegex = /https?:\/\/[^\s<>"')]+/gi;
const externalHttpInputRegex = /(?:^|\s)(https?:\/\/[^\s<>"')]+)\s$/i;

export const DOMAIN_CONFIGS: DomainConfig[] = [
  {
    regex: /^https?:\/\/(?:www\.)?instagram\.com\/([^/?#\s]+)/,
    icon: () => <InstagramLogoIcon aria-hidden="true" />,
    title: (match) => match[1] ?? "",
  },
  {
    regex: /^https?:\/\/(?:www\.)?github\.com\/([^/?#\s]+)(?:\/([^/?#\s]+))?/,
    icon: () => <GithubLogoIcon aria-hidden="true" />,
    title: (match) => {
      const owner = match[1] ?? "";
      const repository = match[2];
      return repository ? `${owner}/${repository}` : owner;
    },
  },
  {
    regex: /^https?:\/\/(?:www\.)?youtube\.com\/(?:@|c\/|user\/)?([^/?#\s]+)/,
    icon: () => <YoutubeLogoIcon weight="fill" />,
    title: (match) => match[1] ?? "",
  },
  {
    regex: /^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([^/?#\s]+)/,
    icon: () => <TwitterLogoIcon weight="fill" />,
    title: (match) => `@${match[1] ?? ""}`,
  },
  {
    regex: /^https?:\/\/(?:www\.)?linkedin\.com\/in\/([^/?#\s]+)/,
    icon: () => <LinkedinLogoIcon aria-hidden="true" />,
    title: (match) => match[1] ?? "",
  },
];

type DomainConfigMatch = {
  config: DomainConfig;
  match: RegExpMatchArray;
};

const getDomainConfigMatch = (url: string): DomainConfigMatch | null => {
  for (const config of DOMAIN_CONFIGS) {
    const match = url.match(config.regex);
    if (match) return { config, match };
  }
  return null;
};

export const getLinkTitleDomain = (url: string): string => {
  const matched = getDomainConfigMatch(url);
  if (matched) return matched.config.title(matched.match);
  return getGenericUrlLabel(url);
};

export function DomainLinkDisplay<As extends React.ElementType>({
  url,
  as,
}: DomainLinkDisplayProps<As>) {
  const As = as || "a";
  const matched = getDomainConfigMatch(url);
  const title = getLinkTitleDomain(url);
  const displayContent = matched ? (
    <>
      {matched.config.icon()}
      <span>{title}</span>
    </>
  ) : (
    <>
      <LinkIcon />
      <span>{title}</span>
    </>
  );
  return (
    <As
      href={url}
      target="_blank"
      contentEditable={false}
      className={commonClasses}
      rel="noopener noreferrer"
    >
      {displayContent}
    </As>
  );
}

const getGenericUrlLabel = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
};

const shouldRenderAsDomainLink = (
  element: HTMLElement,
  href: string,
): boolean => {
  const label = element.textContent?.trim() ?? "";
  return !label || label === href.trim();
};

const DomainLinkView = (props: NodeViewProps) => {
  const href = getStringAttribute(props.node.attrs.href);
  return (
    <NodeViewWrapper
      as="span"
      className="inline-block align-middle mx-1"
      data-link-url={href}
    >
      <LinkPreview trigger={<DomainLinkDisplay url={href} />}>
        <DomainLinkPreview url={href} />
      </LinkPreview>
    </NodeViewWrapper>
  );
};

export const getStringAttribute = (value: unknown): string =>
  typeof value === "string" ? value : "";

export const DomainLink = Node.create({
  atom: true,
  inline: true,
  group: "inline",
  name: "domainLink",
  addAttributes() {
    return {
      href: { default: null },
      text: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: "a[href]",
        priority: 60,
        getAttrs: (element: HTMLElement | string) => {
          if (typeof element === "string") return false;
          const href = element.getAttribute("href");
          if (!href || !shouldRenderAsDomainLink(element, href)) return false;
          for (const config of DOMAIN_CONFIGS) {
            if (config.regex.test(href)) {
              return { href, text: element.textContent || href };
            }
          }
          if (isExternalHttpUrl(href)) {
            return { href, text: element.textContent || href };
          }
          return false;
        },
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        href: node.attrs.href,
        "data-type": "domainLink",
      }),
      node.attrs.text || node.attrs.href,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DomainLinkView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: MarkdownSerializerState,
          node: MarkdownSerializerNode,
        ) {
          const text = node.attrs.text || node.attrs.href;
          const href = node.attrs.href;
          state.write(`[${text}](${href})`);
        },
      },
    };
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: externalHttpPasteRegex,
        handler: ({ match, chain, range }) => {
          if (match && match[0]) {
            chain()
              .insertContentAt(range, {
                type: this.name,
                attrs: { href: match[0], text: match[0] },
              })
              .run();
          }
        },
      }),
    ];
  },
  addInputRules() {
    return [
      nodeInputRule({
        find: externalHttpInputRegex,
        type: this.type,
        getAttributes: (match) => {
          const href = (match[1] || match[0]).trim();
          return { href, text: href };
        },
      }),
    ];
  },
});

const isExternalHttpUrl = (href: string): boolean => {
  return externalHttpUrlRegex.test(href);
};
