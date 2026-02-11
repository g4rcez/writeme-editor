import CodeBlock from '@tiptap/extension-code-block'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { CodeMirrorBlock } from '../components/codemirror-block'
import { textblockTypeInputRule } from '@tiptap/core'

export const CodeBlockV2 = CodeBlock.extend({
  // Use standard codeBlock name to replace the default one
  name: 'codeBlock',
  
  // It is not an atom, it has content
  atom: false,

  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: 'javascript',
        renderHTML: (attributes) => ({
           class: `language-${attributes.language}`,
        }),
      }
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeMirrorBlock, {
      stopEvent: ({ event }) => {
        // Prevent Tiptap from handling key events inside CodeMirror
        // This is crucial for Vim mode to capture keys like Escape, :, /, etc.
        if (event instanceof KeyboardEvent || event instanceof ClipboardEvent || event instanceof InputEvent || event.type === 'paste') {
           return true;
        }
        return false;
      }
    })
  },
  
  addInputRules() {
    return [
      textblockTypeInputRule({
        find: /^```([a-zA-Z0-9]*)?[\s\n]$/,
        type: this.type,
        getAttributes: (match) => ({
          language: match[1],
        }),
      }),
    ]
  },
})
