import { Node } from "@tiptap/core";


const CodeBlock = Node.create({
    name: 'codeBlock',
});

const ShikiBlock = CodeBlock.extend({
    addStorage() {
        return {
            markdown: {
                serialize(state, node) {
                    state.write("```" + (node.attrs.language || "") + "\n");
                    state.text(node.textContent, false);
                    state.ensureNewLine();
                    state.write("```");
                    state.closeBlock(node);
                },
                parse: {
                    updateDOM(element) {
                        element.innerHTML = element.innerHTML.replace(/\n<\/code><\/pre>/g, '</code></pre>')
                    },
                },
            }
        }
    }
});

export default ShikiBlock;
