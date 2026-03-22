import { editorGlobalRef } from "@/app/editor-global-ref";
import { notificationRef } from "@/app/notification-ref";
import { isElectron } from "@/lib/is-electron";
import { globalState } from "@/store/global.store";
import { Extension } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const DELETION_DELAY_MS = 10_000;
const MEDIA_TYPES = new Set(["image", "video", "pdf"]);

type PendingEntry = { timer: NodeJS.Timeout; close: () => void };
const pendingDeletions = new Map<string, PendingEntry>();

function collectMediaSrcs(node: Node): Set<string> {
  const srcs = new Set<string>();
  node.descendants((child) => {
    if (
      MEDIA_TYPES.has(child.type.name) &&
      typeof child.attrs.src === "string" &&
      child.attrs.src.startsWith("assets/")
    ) {
      srcs.add(child.attrs.src);
    }
  });
  return srcs;
}

function cancelDeletion(src: string) {
  const entry = pendingDeletions.get(src);
  if (!entry) return;
  clearTimeout(entry.timer);
  entry.close();
  pendingDeletions.delete(src);
}

function scheduleAssetDeletion(src: string) {
  if (!isElectron()) return;
  const notify = notificationRef.current;
  const description = (
    <div className="flex items-center gap-2">
      <span>File will be deleted in 10s.</span>
      <button
        type="button"
        className="shrink-0 font-semibold underline underline-offset-2 hover:opacity-70"
        onClick={() => {
          cancelDeletion(src);
          editorGlobalRef.current?.commands.undo();
        }}
      >
        Undo
      </button>
    </div>
  );
  const { close } = notify
    ? notify(description, {
        theme: "info",
        closable: true,
        id: `asset-delete:${src}`,
        timeout: DELETION_DELAY_MS,
      })
    : { close: () => {} };
  const timer = setTimeout(async () => {
    pendingDeletions.delete(src);
    const projectDir = globalState().directory;
    if (!projectDir) return;
    const fullPath = `${projectDir.replace(/\/$/, "")}/${src}`;
    try {
      await window.electronAPI.fs.deleteFile(fullPath);
    } catch (e) {
      console.error("Failed to delete asset file", fullPath, e);
    }
  }, DELETION_DELAY_MS);
  pendingDeletions.set(src, { timer, close });
}

export const AssetCleanup = Extension.create({
  name: "assetCleanup",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("asset-cleanup"),
        state: {
          init(_, { doc }) {
            return collectMediaSrcs(doc);
          },
          apply(tr, oldSrcs, _, newState) {
            if (!tr.docChanged) return oldSrcs;
            const newSrcs = collectMediaSrcs(newState.doc);
            for (const src of newSrcs) {
              if (pendingDeletions.has(src)) {
                cancelDeletion(src);
              }
            }
            if (tr.getMeta("preventUpdate")) return newSrcs;
            for (const src of oldSrcs) {
              if (!newSrcs.has(src)) {
                scheduleAssetDeletion(src);
              }
            }
            return newSrcs;
          },
        },
      }),
    ];
  },
});
