import { Node } from "@tiptap/core";

const TaskItem = Node.create({
  name: "taskItem",
});

export default TaskItem.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          const check = node.attrs.checked ? "[x]" : "[ ]";
          state.write(`${check} `);
          state.renderContent(node);
        },
        parse: {
          updateDOM(element) {
            [...element.querySelectorAll(".task-list-item")].forEach((item) => {
              const input = item.querySelector("input");
              item.setAttribute("data-type", "taskItem");
              if (input) {
                item.setAttribute("data-checked", String(input.checked));
                input.remove();
              }
              while (
                item.firstChild &&
                item.firstChild.nodeType === 3 &&
                !item.firstChild.textContent.trim()
              ) {
                item.firstChild.remove();
              }
              let textNode = item.firstChild;
              if (textNode && textNode.nodeName.toUpperCase() === "P") {
                textNode = textNode.firstChild;
              }
              if (textNode && textNode.nodeType === 3) {
                textNode.textContent = textNode.textContent.replace(/^\s+/, "");
              }
            });
          },
        },
      },
    };
  },
});
