import { Node } from "@tiptap/core";
import taskListPlugin from "markdown-it-task-lists";

const TaskList = Node.create({
  name: "taskList",
});

export default TaskList.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          console.log(state, node);
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
            " ",
            () =>
              (this.editor.storage.markdown.options.bulletListMarker || "-") +
              " ",
          );
        },
        parse: {
          setup(markdownit) {
            markdownit.use(taskListPlugin);
          },
          updateDOM(element: HTMLElement) {
            console.log(element);
            element.querySelectorAll(".contains-task-list").forEach((list) => {
              list.setAttribute("data-type", "taskList");
            });
          },
        },
      },
    };
  },
});
