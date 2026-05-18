import { Button, Input, Modal } from "@g4rcez/components";
import { type SubmitEvent, useState } from "react";
import { globalState, useGlobalStore } from "@/store/global.store";
import { CheckIcon, FoldersIcon } from "@phosphor-icons/react";

export const AddToGroupDialog = () => {
  const [state, dispatch] = useGlobalStore();
  const [newTitle, setNewTitle] = useState("");
  if (!state.note) return null;
  const noteId = state.note.id;

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = newTitle.trim();
    if (!value) return;
    await dispatch.createGroup(value);
    const created = globalState().noteGroups.at(-1);
    if (created) {
      await dispatch.addNoteToGroup(created.id, noteId);
    }
    setNewTitle("");
    dispatch.setAddToGroupDialog(false);
  };

  return (
    <Modal
      type="dialog"
      title="Add to group"
      className="max-w-lg"
      open={state.addToGroupDialog}
      onChange={dispatch.setAddToGroupDialog}
    >
      <div className="flex flex-col gap-4">
        <form onSubmit={onSubmit} className="flex gap-2 items-end">
          <Input
            value={newTitle}
            title="New group"
            placeholder="Group name"
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Button type="submit" theme="primary" disabled={!newTitle.trim()}>
            Create
          </Button>
        </form>
        {state.noteGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No groups yet — create one above.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {state.noteGroups.map((group) => {
              const isMember = state.noteGroupMembers.some(
                (m) => m.groupId === group.id && m.noteId === noteId,
              );
              return (
                <li key={group.id}>
                  <Button
                    theme="ghost-primary"
                    disabled={isMember}
                    className="flex w-full items-center justify-between"
                    onClick={async () => {
                      await dispatch.addNoteToGroup(group.id, noteId);
                      dispatch.setAddToGroupDialog(false);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <FoldersIcon />
                      <span>{group.title}</span>
                    </span>
                    {isMember && (
                      <CheckIcon
                        weight="bold"
                        className="size-4 text-primary"
                      />
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
};
