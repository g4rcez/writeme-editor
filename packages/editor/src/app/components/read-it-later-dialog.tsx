import { Button, Input, Modal } from "@g4rcez/components";
import { type SubmitEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { identifyDomain } from "@/lib/url-utils";
import { ensureReadItLaterFrontmatter, isSafeHttpUrl } from "@/lib/read-it-later-library";
import { fetchReadItLaterUrl, parseReadItLaterHtml } from "@/lib/read-it-later-utils";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";
import { useUIStore } from "@/store/ui.store";
import { readItLaterHtmlToMarkdown } from "../read-it-later-content";

export const ReadItLaterDialog = () => {
    const [state, dispatch] = useGlobalStore();
    const [, uiDispatch] = useUIStore();
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleCreate = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        const sourceUrl = url.trim();
        if (!sourceUrl) return;
        setLoading(true);
        try {
            if (!isSafeHttpUrl(sourceUrl)) throw new Error("Use a valid HTTP or HTTPS URL.");
            const video = identifyDomain(sourceUrl);
            let note: Note;
            if (video) {
                const videoUrl = video.url.replace(/[()]/g, (character) => encodeURIComponent(character));
                const content = ensureReadItLaterFrontmatter(`![youtube](${videoUrl})\n`);
                note = Note.new(
                    "YouTube video",
                    content,
                    NoteType["read-it-later"],
                    video.url,
                    null,
                    null,
                    { readItLaterSource: "youtube", videoId: video.id },
                );
            } else {
                const html = await fetchReadItLaterUrl(sourceUrl);
                const article = parseReadItLaterHtml(html, sourceUrl, window.location.origin);
                const markdown = readItLaterHtmlToMarkdown(article.html, state.theme);
                note = Note.new(
                    article.title,
                    ensureReadItLaterFrontmatter(markdown),
                    NoteType["read-it-later"],
                    sourceUrl,
                    article.description,
                    article.favicon,
                    { readItLaterSource: "web" },
                );
            }
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
                message: "Failed to create note from URL. Please check the URL and try again.",
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
                <p className="text-sm">Enter a URL to fetch its content and save it as a note.</p>
                <Input
                    required
                    type="url"
                    value={url}
                    title="URL to the article/post"
                    placeholder="https://example.com"
                    onChange={(e) => setUrl(e.target.value)}
                    className="p-2 w-full bg-transparent rounded border focus:ring-2 focus:outline-none border-input focus:ring-primary"
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
                    <Button type="submit" disabled={!url} theme="primary" loading={loading}>
                        {loading ? "Creating note..." : "Create Note"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
