import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Node } from "@tiptap/pm/model";
import { repositories, globalState } from "../../store/global.store";
import { isElectron } from "../../lib/is-electron";

function findHashtags(doc: Node): {
  decorations: DecorationSet;
  tags: string[];
} {
  const decorations: Decoration[] = [];
  const tags: string[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText) return;
    if (node.marks.some((m) => m.type.name === "code")) return;
    const text = node.text || "";
    // Regex for hashtags: # followed by word chars. Adjust as needed.
    const matches = Array.from(text.matchAll(/#([\w\-]+)/g));

    matches.forEach((match) => {
      const start = pos + match.index;
      const end = start + match[0].length;
      const tag = match[1];
      tags.push(tag);

      const href = isElectron() ? `#/tags/${tag}` : `/tags/${tag}`;

      decorations.push(
        Decoration.inline(start, end, {
          nodeName: "a",
          class: "hashtag text-primary hover:underline cursor-pointer", // Tailwind classes
          href: href,
          // data attributes for router if needed
        }),
      );
    });
  });

  return {
    decorations: DecorationSet.create(doc, decorations),
    tags: [...new Set(tags)],
  };
}

const saveTimer: Record<string, NodeJS.Timeout> = {};

async function saveHashtags(noteId: string, filename: string, tags: string[]) {
  if (saveTimer[noteId]) clearTimeout(saveTimer[noteId]);

  saveTimer[noteId] = setTimeout(async () => {
    try {
      await repositories.hashtags.sync(filename, tags);
    } catch (e) {
      console.error("Failed to sync hashtags", e);
    }
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
            return findHashtags(doc).decorations;
          },
          apply(tr, old, oldState, newState) {
            if (tr.docChanged) {
              const { decorations, tags } = findHashtags(newState.doc);

              const state = globalState();
              if (state.note) {
                saveHashtags(
                  state.note.id,
                  state.note.filePath || state.note.title,
                  tags,
                );
              }

              return decorations;
            }
            return old.map(tr.mapping, tr.doc);
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
