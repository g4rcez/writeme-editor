import { Settings } from "lucide-react";
import { useGlobalStore } from "../../store/global.store";

export const SettingsMenu = () => {
  const [, dispatch] = useGlobalStore();
  return (
    <button
      type="button"
      title="Settings"
      aria-label="Settings menu"
      onClick={() => dispatch.commander(true)}
      className="flex justify-center items-center w-8 h-8 rounded-md transition-all text-foreground/70 hover:text-foreground hover:bg-muted/30"
    >
      <Settings className="size-4" />
    </button>
  );
};
