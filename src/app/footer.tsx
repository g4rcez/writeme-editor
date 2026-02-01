import { PanelLeftIcon } from "lucide-react";
import { useUIStore } from "../store/ui.store";

export const Footer = () => {
  const [, uiDispatch] = useUIStore();
  return (
    <footer className="flex fixed bottom-0 items-center mx-auto w-full bg-background h-navbar max-w-safe">
      <button
        title="Open sidebar"
        onClick={uiDispatch.toggleSidebar}
        className="hidden justify-center items-center rounded-md transition-all lg:flex size-8 text-foreground/70 hover:text-foreground hover:bg-muted/30"
      >
        <PanelLeftIcon className="size-4" />
      </button>
    </footer>
  );
};
