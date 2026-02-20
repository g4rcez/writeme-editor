import { Button, Input, Modal, uuid } from "@g4rcez/components";
import { useState } from "react";
import { useGlobalStore, repositories } from "@/store/global.store";
import { Script } from "@/store/repositories/entities/script";
import { Editor } from "../editor";
import { useScripts } from "../hooks/use-scripts";
import { parse as mdParser } from "marked";

export const CreateVariableDialog = () => {
  const [state, dispatch] = useGlobalStore();
  const { refresh } = useScripts();
  const [name, setName] = useState("");
  const [expression, setExpression] = useState("return 'Value';");

  const handleClose = () => {
    dispatch.setCreateVariableDialog(false);
    setName("");
    setExpression("return 'Value';");
  };

  const handleCreate = async () => {
    if (!name) return;

    const newScript = new Script(
      uuid(),
      name.toUpperCase().replace(/\s+/g, "_"),
      expression,
      new Date(),
      new Date(),
    );

    await repositories.scripts.save(newScript);
    refresh();
    handleClose();
  };

  return (
    <Modal
      open={state.createVariableDialog.isOpen}
      onChange={handleClose}
      title="Create Custom Variable"
      className="w-full max-w-4xl"
    >
      <div className="flex flex-col gap-6">
        <div className="space-y-2">
          <Input
            autoFocus
            value={name}
            title="Variable name"
            placeholder="MY_VARIABLE"
            onChange={(e) => setName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Use uppercase and underscores. Available as{" "}
            <code>{"{{VAR_NAME}}"}</code>. This is suggestion pattern.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Expression (JavaScript)</label>
          <Editor
            id="variable-expression-editor"
            content={`\`\`\`javascript
${expression}
\`\`\``}
            onSave={async (content) => {
              const dom = new DOMParser().parseFromString(
                mdParser(content, {
                  gfm: true,
                  breaks: false,
                  async: false,
                  silent: true,
                }),
                "text/html",
              );
              const codeBlock = dom.querySelector("code").innerText;
              setExpression(codeBlock.trim().replace(/\n$/g, ""));
            }}
          />
          <p className="text-xs text-muted-foreground">
            Must use <code>return</code> to provide a value.
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button theme="ghost-muted" onClick={handleClose}>
            Cancel
          </Button>
          <Button theme="primary" onClick={handleCreate} disabled={!name}>
            Create
          </Button>
        </div>
      </div>
    </Modal>
  );
};
