import { NodeViewWrapper } from "@tiptap/react";
import { globalDispatch } from "../../store/global.store";

export const FileReferenceView = (props: any) => {
  const { id, label } = props.node.attrs;

  const onClick = () => {
    if (id) {
      globalDispatch.selectNoteById(id);
    }
  };

  const displayLabel = label || (id?.includes("/") ? id.split("/").pop() : id);

  return (
    <NodeViewWrapper className="inline-block align-middle">
      <span
        onClick={onClick}
        className="file-reference-chip bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded-md cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors inline-flex items-center gap-1"
      >
        <span className="opacity-50">@</span>
        {displayLabel}
      </span>
    </NodeViewWrapper>
  );
};
