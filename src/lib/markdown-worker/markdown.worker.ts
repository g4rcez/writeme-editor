import { Marked } from "marked";
import { linkify } from "@/lib/link-utils";
import { dedent } from "./dedent";

const md = new Marked({ gfm: true, breaks: true });

export function processMarkdown(text: string): string {
  const dedented = dedent(text);
  const linkified = linkify(dedented);
  return md.parse(linkified) as string;
}

self.onmessage = (e: MessageEvent<{ text: string }>) => {
  const html = processMarkdown(e.data.text);
  self.postMessage({ html });
};
