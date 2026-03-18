import { GithubLogoIcon } from "@phosphor-icons/react/dist/csr/GithubLogo";
import { InstagramLogoIcon } from "@phosphor-icons/react/dist/csr/InstagramLogo";
import { LinkIcon } from "@phosphor-icons/react/dist/csr/Link";
import { TwitterLogoIcon } from "@phosphor-icons/react/dist/csr/TwitterLogo";
import { YoutubeLogoIcon } from "@phosphor-icons/react/dist/csr/YoutubeLogo";
import { Node, PasteRule, mergeAttributes, nodeInputRule } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import React from "react";

export type DomainConfig = {
  regex: RegExp;
  component: (url: string, match: RegExpMatchArray) => React.ReactNode;
};

const commonClasses = "inline-flex items-center gap-1 link";

export const DOMAIN_CONFIGS: DomainConfig[] = [
  {
    regex: /^https?:\/\/(?:www\.)?instagram\.com\/([^\/?#\s]+)/,
    component: (url, match) => (
      <a
        href={url}
        target="_blank"
        contentEditable={false}
        className={commonClasses}
        rel="noopener noreferrer"
      >
        <InstagramLogoIcon aria-hidden="true" />
        <span>{match[1]}</span>
      </a>
    ),
  },
  {
    regex: /^https?:\/\/(?:www\.)?github\.com\/([^\/?#\s]+)(?:\/([^\/?#\s]+))?/,
    component: (url, match) => (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={commonClasses}
        contentEditable={false}
      >
        <GithubLogoIcon aria-hidden="true" />
        <span>
          {match[1]}
          {match[2] ? `/${match[2]}` : ""}
        </span>
      </a>
    ),
  },
  {
    regex: /^https?:\/\/(?:www\.)?youtube\.com\/(?:@|c\/|user\/)?([^\/?#\s]+)/,
    component: (url, match) => (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={commonClasses}
        contentEditable={false}
      >
        <YoutubeLogoIcon weight="fill" />
        <span>{match[1]}</span>
      </a>
    ),
  },
  {
    regex: /^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([^\/?#\s]+)/,
    component: (url, match) => (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={commonClasses}
        contentEditable={false}
      >
        <TwitterLogoIcon weight="fill" />
        <span>@{match[1]}</span>
      </a>
    ),
  },
];

const DomainLinkView = (props: any) => {
  const href = props.node.attrs.href || "";
  let renderedComponent: React.ReactNode = null;

  for (const config of DOMAIN_CONFIGS) {
    const match = href.match(config.regex);
    if (match) {
      renderedComponent = config.component(href, match);
      break;
    }
  }

  if (!renderedComponent) {
    renderedComponent = (
      <a
        href={href}
        target="_blank"
        contentEditable={false}
        className={commonClasses}
        rel="noopener noreferrer"
      >
        <LinkIcon />
        <span>{props.node.attrs.text || href}</span>
      </a>
    );
  }

  return (
    <NodeViewWrapper as="span" className="inline-block align-middle mx-1">
      {renderedComponent}
    </NodeViewWrapper>
  );
};

export const DomainLink = Node.create({
  name: "domainLink",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      href: {
        default: null,
      },
      text: {
        default: null,
      },
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
          if (!href) return false;

          for (const config of DOMAIN_CONFIGS) {
            if (config.regex.test(href)) {
              return {
                href,
                text: element.textContent || href,
              };
            }
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
        serialize(state: any, node: any) {
          const text = node.attrs.text || node.attrs.href;
          const href = node.attrs.href;
          state.write(`[${text}](${href})`);
        },
      },
    };
  },

  addPasteRules() {
    return DOMAIN_CONFIGS.map((config) => {
      const sourceStr = config.regex.source.replace(/^\^/, ""); // remove start anchor for global match
      const globalRegex = new RegExp(sourceStr, "gi");

      return new PasteRule({
        find: globalRegex,
        handler: ({ match, chain, range }: any) => {
          if (match && match[0]) {
            chain()
              .insertContentAt(range, {
                type: this.name,
                attrs: {
                  href: match[0],
                  text: match[0],
                },
              })
              .run();
          }
        },
      });
    });
  },

  addInputRules() {
    return DOMAIN_CONFIGS.map((config) => {
      const sourceStr = config.regex.source.replace(/^\^/, ""); // remove start anchor
      const inputRegex = new RegExp(`(?:^|\\s)(${sourceStr})\\s$`, "i");

      return nodeInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: (match) => {
          const href = (match[1] || match[0]).trim();
          return {
            href,
            text: href,
          };
        },
      });
    });
  },
});
