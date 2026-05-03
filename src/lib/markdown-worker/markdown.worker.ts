/// <reference lib="webworker" />
import { Marked } from "marked";
import { linkify } from "@/lib/link-utils";
import { dedent } from "./dedent";

const md = new Marked({ gfm: true, breaks: true });

export function processMarkdown(text: string): string {
  const dedented = dedent(text);
  const linkified = linkify(dedented);
  return md.parse(linkified, { async: false }) as string;
}

if (
  typeof DedicatedWorkerGlobalScope !== "undefined" &&
  self instanceof DedicatedWorkerGlobalScope
) {
  self.onmessage = (e: MessageEvent<{ text: string; gen: number }>) => {
    const { text, gen } = e.data;
    try {
      const html = processMarkdown(text);
      self.postMessage({ html, gen });
    } catch (err) {
      self.postMessage({ html: "", error: String(err), gen });
    }
  };
}
