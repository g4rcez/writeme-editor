import { Button, Input, Modal } from "@g4rcez/components";
import { Editor } from "@tiptap/core";
import DOMPurify from "dompurify";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isElectron } from "@/lib/is-electron";
import { proxyFetch } from "@/lib/proxy-fetch";
import { parseReadItLaterHtml } from "@/lib/read-it-later-utils";
import { repositories, useGlobalStore } from "@/store/global.store";
import { useUIStore } from "@/store/ui.store";
import { Note } from "@/store/note";
import { getThemeForMode } from "../elements/code-block";
import { createExtensions } from "../extensions";

export const ReadItLaterDialog = () => {
  const [state, dispatch] = useGlobalStore();
  const [, uiDispatch] = useUIStore();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    try {
      let html: string;
      if (isElectron()) {
        const result = await window.electronAPI.readItLater.fetchUrl(url);
        if (!result.success)
          throw new Error(result.error || "Failed to fetch URL");
        html = result.html!;
      } else {
        const response = await proxyFetch(url);
        html = await response.text();
      }
      const article = parseReadItLaterHtml(
        DOMPurify.sanitize(html, { WHOLE_DOCUMENT: true }),
        url,
        window.location.origin,
      );
      const tempEditor = new Editor({
        content: article.html,
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
      uiDispatch.setAlert({
        open: true,
        title: "Read it later",
        message:
          "Failed to create note from URL. Please check the URL and try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      type="dialog"
      title="Read it later"
      className="max-w-[512px]"
      open={state.readItLaterDialog}
      onChange={dispatch.readItLaterDialog}
    >
      <form onSubmit={handleCreate} className="flex flex-col gap-6">
        <p className="text-sm">
          Enter a URL to fetch its content and save it as a note.
        </p>
        <Input
          required
          type="url"
          value={url}
          title="URL to the article/post"
          placeholder="https://example.com"
          onChange={(e) => setUrl(e.target.value)}
          className="p-2 w-full bg-transparent rounded border focus:ring-2 focus:outline-none border-input focus:ring-primary"
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            loading={loading}
            theme="ghost-muted"
            onClick={() => dispatch.readItLaterDialog(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!url}
            theme="primary"
            loading={loading}
          >
            {loading ? "Creating note..." : "Create Note"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
