import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { useEffect } from "react";
import { useGlobalStore } from "@/store/global.store";
import { NavbarButton } from "./navbar-button";

export const NewNoteButton = () => {
  const [, dispatch] = useGlobalStore();

  const createNewNote = () =>
    dispatch.setCreateNoteDialog({ isOpen: true, type: "note" });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        createNewNote();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <NavbarButton Icon={PlusIcon} title="New note (⌘N)" onClick={createNewNote} />
  );
};
