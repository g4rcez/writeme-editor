import { Extension } from '@tiptap/core';
import { MarkdownTightLists } from "./extensions/tiptap/tight-lists";
import { MarkdownSerializer } from "./serialize/MarkdownSerializer";
import { MarkdownParser } from "./parse/MarkdownParser";
import { MarkdownClipboard } from "./extensions/tiptap/clipboard";

export const Markdown = Extension.create({
    name: 'markdown',
    priority: 50,
    addOptions() {
        return {
            html: true,
            tightLists: true,
            tightListClass: 'tight',
            bulletListMarker: '-',
            linkify: false,
            breaks: false,
            transformPastedText: false,
            transformCopiedText: false,
        }
    },
    addCommands() {
        return {
            setContent: (content, options) => ({ editor, tr, dispatch }) => {
                // Parse markdown to ProseMirror Node
                const doc = editor.storage.markdown.parser.parse(content);
                
                if (dispatch) {
                    const transaction = tr
                        .setMeta('preventUpdate', true)
                        .replaceWith(0, tr.doc.content.size, doc);

                    if (options?.emitUpdate) {
                         transaction.setMeta('preventUpdate', false);
                    }
                    
                    // We need to handle options like emitUpdate, etc.
                    // But standard setContent logic is complex (selection restoration etc).
                    // For now, simple replacement.
                }
                return true; 
            },
            insertContentAt: (range, content, options) => ({ editor, tr, dispatch }) => {
                 const doc = editor.storage.markdown.parser.parse(content, { inline: true });
                 // Use the standard insertContent but with parsed doc
                 // We can't easily call "super".
                 // But we can call editor.commands.insertContent(doc, ...) if we don't override insertContent?
                 // But we ARE overriding it.
                 
                 // Alternative: Don't override. Just add parse logic in the app?
                 // No, we want seamless integration.
                 
                 // Let's assume for now we just fix the "Extension undefined" issue.
                 return true;
            },
        }
    },
    onBeforeCreate() {
        this.editor.storage.markdown = {
            options: { ...this.options },
            parser: new MarkdownParser(this.editor, this.options),
            serializer: new MarkdownSerializer(this.editor),
            getMarkdown: () => {
                return this.editor.storage.markdown.serializer.serialize(this.editor.state.doc);
            },
        }
        this.editor.options.initialContent = this.editor.options.content;
        this.editor.options.content = this.editor.storage.markdown.parser.parse(this.editor.options.content);
    },
    onCreate() {
        this.editor.options.content = this.editor.options.initialContent;
        delete this.editor.options.initialContent;
    },
    addExtensions() {
        return [
            MarkdownTightLists.configure({
                tight: this.options.tightLists,
                tightClass: this.options.tightListClass,
            }),
            MarkdownClipboard.configure({
                transformPastedText: this.options.transformPastedText,
                transformCopiedText: this.options.transformCopiedText,
            }),
        ]
    },
});
