import { useGlobalStore, repositories } from "../../store/global.store";
import { Modal } from "@g4rcez/components";
import { Note } from "../../store/note";
import { useNavigate } from "react-router-dom";
import { parseReadItLaterHtml } from "../../lib/read-it-later-utils";
import { Editor } from "@tiptap/core";
import { createExtensions } from "../extensions";
import { getThemeForMode } from "../elements/code-block";
import { useState } from "react";
import DOMPurify from "dompurify";

export const ReadItLaterDialog = () => {
  const [state, dispatch] = useGlobalStore();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const response = await fetch(url);
      const html = await response.text();
      const article = parseReadItLaterHtml(
        DOMPurify.sanitize(html, { WHOLE_DOCUMENT: true }),
        url,
        window.location.origin,
      );
      const tempEditor = new Editor({
        content: article.content,
        extensions: createExtensions(() => getThemeForMode(state.theme)),
      });
      const markdown = (tempEditor.storage as any).markdown.getMarkdown();
      tempEditor.destroy();
      const note = Note.new(
        article.title,
        markdown,
        "read-it-later",
        url,
        article.description,
        article.favicon,
      );
      await repositories.notes.save(note);
      dispatch.note(note);
      dispatch.readItLaterDialog(false);
      navigate(`/note/${note.id}`);
      setUrl("");
    } catch (error) {
      console.error("Failed to fetch or parse URL:", error);
      alert(
        "Failed to create note from URL. Please check the URL and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      type="dialog"
      title="Read It Later"
      open={state.readItLaterDialog}
      onChange={dispatch.readItLaterDialog}
      className="max-w-[512px]"
    >
      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm text-muted-foreground">
          Enter a URL to fetch its content and save it as a note.
        </p>
        <input
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
          className="p-2 w-full bg-transparent rounded border focus:ring-2 focus:outline-none border-input focus:ring-primary"
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={() => dispatch.readItLaterDialog(false)}
            className="py-2 px-4 text-sm rounded hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="py-2 px-4 text-sm text-white rounded disabled:opacity-50 bg-primary hover:bg-primary/90"
            disabled={loading || !url}
          >
            {loading ? "Creating..." : "Create Note"}
          </button>
        </div>
      </div>
    </Modal>
  );
};
