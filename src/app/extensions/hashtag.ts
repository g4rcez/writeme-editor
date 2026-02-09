import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Node } from "@tiptap/pm/model";
import { v7 as uuidv7 } from "uuid";
import { db } from "../../store/repositories/dexie/dexie-db";
import { globalState } from "../../store/global.store";
import { isElectron } from "../../lib/is-electron";

function findHashtags(doc: Node): { decorations: DecorationSet, tags: string[] } {
  const decorations: Decoration[] = [];
  const tags: string[] = [];
  
  doc.descendants((node, pos) => {
      if (!node.isText) return;
      const text = node.text || "";
      // Regex for hashtags: # followed by word chars. Adjust as needed.
      const matches = Array.from(text.matchAll(/#([\w\-]+)/g));
      
      matches.forEach(match => {
          const start = pos + match.index;
          const end = start + match[0].length;
          const tag = match[1];
          tags.push(tag);
          
          const href = isElectron() 
            ? `#/tags/${tag}` 
            : `/tags/${tag}`;

          decorations.push(
              Decoration.inline(start, end, {
                  nodeName: 'a',
                  class: 'hashtag text-primary hover:underline cursor-pointer', // Tailwind classes
                  href: href,
                  // data attributes for router if needed
              })
          );
      });
  });
  
  return {
      decorations: DecorationSet.create(doc, decorations),
      tags: [...new Set(tags)]
  };
}

const saveTimer: Record<string, NodeJS.Timeout> = {};

async function saveHashtags(noteId: string, filename: string, tags: string[]) {
    if (saveTimer[noteId]) clearTimeout(saveTimer[noteId]);
    
    saveTimer[noteId] = setTimeout(async () => {
        try {
            await db.transaction('rw', db.hashtags, async () => {
                const existing = await db.hashtags.where('filename').equals(filename).toArray();
                const existingTags = existing.map(e => e.hashtag);
                
                const added = tags.filter(t => !existingTags.includes(t));
                const removed = existingTags.filter(t => !tags.includes(t));
                
                if (added.length === 0 && removed.length === 0) return;
                
                if (removed.length > 0) {
                    const idsToRemove = existing.filter(e => removed.includes(e.hashtag)).map(e => e.id);
                    await db.hashtags.bulkDelete(idsToRemove);
                }
                
                if (added.length > 0) {
                    const newEntries = added.map(tag => ({
                        id: uuidv7(),
                        hashtag: tag,
                        filename: filename,
                        project: "default" 
                    }));
                    await db.hashtags.bulkAdd(newEntries);
                }
            });
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
                        saveHashtags(state.note.id, state.note.filePath || state.note.title, tags);
                    }
                    
                    return decorations;
                }
                return old.map(tr.mapping, tr.doc);
            }
        },
        props: {
            decorations(state) {
                return this.getState(state);
            }
        }
      })
    ]
  }
});