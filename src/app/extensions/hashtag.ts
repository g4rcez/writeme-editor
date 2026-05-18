import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Node as PmNode } from "@tiptap/pm/model";
import { repositories, globalState } from "../../store/global.store";
import { isElectron } from "../../lib/is-electron";

const HASHTAG_RE = /#([\w-]+)/g;
const HEX_COLOR_TAG_RE =
  /^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{4}$|^[0-9a-fA-F]{6}$|^[0-9a-fA-F]{8}$/;

function makeDecoration(start: number, end: number, tag: string): Decoration {
  const href = isElectron() ? `#/tags/${tag}` : `/tags/${tag}`;
  return Decoration.inline(start, end, {
    nodeName: "a",
    class: "hashtag text-primary hover:underline cursor-pointer",
    href,
  });
}

function scanRange(
  doc: PmNode,
  from: number,
  to: number,
  out: Decoration[],
  tags: Set<string>,
) {
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return;
    if (node.marks.some((m) => m.type.name === "code")) return;
    const text = node.text ?? "";
    HASHTAG_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = HASHTAG_RE.exec(text)) !== null) {
      const start = pos + m.index;
      const end = start + m[0].length;
      const tag = m[1] ?? "";
      if (HEX_COLOR_TAG_RE.test(tag)) continue;
      tags.add(tag);
      out.push(makeDecoration(start, end, tag));
    }
  });
}

function findAllHashtags(doc: PmNode): {
  decorations: DecorationSet;
  tags: string[];
} {
  const decorations: Decoration[] = [];
  const tags = new Set<string>();
  scanRange(doc, 0, doc.content.size, decorations, tags);
  return {
    decorations: DecorationSet.create(doc, decorations),
    tags: [...tags],
  };
}

function expandToBlock(doc: PmNode, pos: number): { from: number; to: number } {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  const depth = $pos.depth;
  const node = $pos.node(depth);
  const start = $pos.start(depth);
  return { from: start, to: start + node.content.size };
}

const saveTimer: Record<string, NodeJS.Timeout> = {};

function saveHashtags(noteId: string, filename: string, tags: string[]) {
  if (saveTimer[noteId]) clearTimeout(saveTimer[noteId]);
  saveTimer[noteId] = setTimeout(async () => {
    try {
      await repositories.hashtags.sync(filename, tags);
    } catch (e) {
      console.error("Failed to sync hashtags", e);
    }
  }, 1000);
}

function collectAllTags(doc: PmNode): string[] {
  const tags = new Set<string>();
  const dummy: Decoration[] = [];
  scanRange(doc, 0, doc.content.size, dummy, tags);
  return [...tags];
}

const syncTimer: Record<string, NodeJS.Timeout> = {};

function scheduleTagSync(doc: PmNode) {
  const state = globalState();
  if (!state.note) return;
  const { id, filePath, title } = state.note;
  if (syncTimer[id]) clearTimeout(syncTimer[id]);
  syncTimer[id] = setTimeout(() => {
    const tags = collectAllTags(doc);
    saveHashtags(id, filePath || title, tags);
  }, 1000);
}

export const Hashtag = Extension.create({
  name: "hashtag",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("hashtag-handler"),
        state: {
          init(_, { doc }) {
            return findAllHashtags(doc).decorations;
          },
          apply(tr, old, _oldState, newState) {
            if (!tr.docChanged) return old.map(tr.mapping, tr.doc);

            const mapped = old.map(tr.mapping, tr.doc);

            const touchedRanges: Array<{ from: number; to: number }> = [];
            tr.mapping.maps.forEach((stepMap) => {
              stepMap.forEach((_oS, _oE, newStart, newEnd) => {
                touchedRanges.push(
                  expandToBlock(newState.doc, newStart),
                  expandToBlock(newState.doc, newEnd),
                );
              });
            });

            if (touchedRanges.length === 0) {
              scheduleTagSync(newState.doc);
              return mapped;
            }

            touchedRanges.sort((a, b) => a.from - b.from);
            const merged: Array<{ from: number; to: number }> = [];
            for (const r of touchedRanges) {
              const last = merged[merged.length - 1];
              if (last && r.from <= last.to) {
                last.to = Math.max(last.to, r.to);
              } else {
                merged.push({ from: r.from, to: r.to });
              }
            }

            const additions: Decoration[] = [];
            const tags = new Set<string>();
            let next = mapped;

            for (const { from, to } of merged) {
              const stale = next.find(from, to);
              if (stale.length > 0) next = next.remove(stale);
              scanRange(newState.doc, from, to, additions, tags);
            }

            if (additions.length > 0) {
              next = next.add(newState.doc, additions);
            }

            scheduleTagSync(newState.doc);
            return next;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
