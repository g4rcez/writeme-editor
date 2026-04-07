import { Node } from "@tiptap/core";

const TaskList = Node.create({
  name: "taskList",
});

const SPACE = "  ";

export default TaskList.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          const tightNode =
            node.attrs.tight !== true
              ? node.type.create(
                  { ...node.attrs, tight: true },
                  node.content,
                  node.marks,
                )
              : node;
          state.renderList(
            tightNode,
            SPACE,
            () =>
              (this.editor.storage.markdown.options.bulletListMarker || "-") +
              " ",
          );
        },
        parse: {
          updateDOM(element: HTMLElement) {
            element.querySelectorAll("ul").forEach((ul) => {
              if (ul.querySelector('li > input[type="checkbox"]')) {
                ul.setAttribute("data-type", "taskList");
                ul.querySelectorAll("li").forEach((li) =>
                  li.classList.add("task-list-item"),
                );
              }
            });
          },
        },
      },
    };
  },
});
