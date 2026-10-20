import { Editor } from "@tiptap/core";
import DOMPurify from "dompurify";
import { getThemeForMode } from "./elements/code-block";
import { createExtensions } from "./extensions";

type EditorTheme = Parameters<typeof getThemeForMode>[0];

export function readItLaterHtmlToMarkdown(html: string, theme: EditorTheme): string {
    const sanitizedHtml = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    const editor = new Editor({
        content: sanitizedHtml,
        extensions: createExtensions(() => getThemeForMode(theme)),
    });

    try {
        const storage: unknown = editor.storage.markdown;
        if (typeof storage !== "object" || storage === null || !("getMarkdown" in storage)) {
            throw new Error("The Markdown serializer is not available.");
        }
        const getMarkdown = storage.getMarkdown;
        if (typeof getMarkdown !== "function") throw new Error("The Markdown serializer is not available.");
        return getMarkdown.call(storage);
    } finally {
        editor.destroy();
    }
}
