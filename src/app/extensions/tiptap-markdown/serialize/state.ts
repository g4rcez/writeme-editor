import { MarkdownSerializerState as BaseMarkdownSerializerState } from "prosemirror-markdown";
import type { Node, Mark } from "@tiptap/pm/model";
import { trimInline } from "../util/markdown";
import "./types";

type Inline = { start: number; end?: number; delimiter: string };

type AnyMarkdownSerializerStateCtor = new (
  nodes: Record<string, unknown>,
  marks: Record<string, unknown>,
  options?: Record<string, unknown>,
) => BaseMarkdownSerializerState;

const Base =
  BaseMarkdownSerializerState as unknown as AnyMarkdownSerializerStateCtor;

/**
 * Override default MarkdownSerializerState to:
 * - handle commonmark delimiters (https://spec.commonmark.org/0.29/#left-flanking-delimiter-run)
 */
export class MarkdownSerializerState extends Base {
  override inlines: Inline[] = [];

  constructor(
    nodes: Record<string, unknown>,
    marks: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) {
    super(nodes, marks, options ?? {});
    this.inlines = [];
  }

  override render(node: Node, parent: Node, index: number) {
    super.render(node, parent, index);
    const top = this.inlines[this.inlines.length - 1];
    if (top?.start && top?.end) {
      const { delimiter, start, end } = this.normalizeInline(
        top as Required<Inline>,
      );
      this.out = trimInline(this.out, delimiter, start, end);
      this.inlines.pop();
    }
  }

  override markString(
    mark: Mark,
    open: boolean,
    parent: Node,
    index: number,
  ): string {
    const info = this.marks[mark.type.name];
    if (info?.expelEnclosingWhitespace) {
      if (open) {
        this.inlines.push({
          start: this.out.length,
          delimiter: typeof info.open === "string" ? info.open : "",
        });
      } else {
        const top = this.inlines.pop();
        this.inlines.push({
          ...top,
          end: this.out.length,
        } as Inline);
      }
    }
    return super.markString(mark, open, parent, index);
  }

  normalizeInline(inline: Required<Inline>): Required<Inline> {
    let { start } = inline;
    while (this.out.charAt(start).match(/\s/)) {
      start++;
    }
    return {
      ...inline,
      start,
    };
  }
}
