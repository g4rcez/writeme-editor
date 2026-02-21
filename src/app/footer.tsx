import { SidebarIcon } from "@phosphor-icons/react/dist/csr/Sidebar";
import { useEffect, useState } from "react";
import { useUIStore } from "../store/ui.store";
import { SettingsService } from "../store/settings";

export const Footer = () => {
  const [, uiDispatch] = useUIStore();
  const [vaultPath, setVaultPath] = useState<string | null>(null);

  useEffect(() => {
    const loadPath = async () => {
      const settings = SettingsService.load();
      if (!settings.directory) return;
      const home = (await window.electronAPI?.env?.getHome()) || "";
      const path = settings.directory;
      setVaultPath(
        home && path.startsWith(home) ? path.replace(home, "~") : path,
      );
    };
    loadPath();
  }, []);

  return (
    <footer className="flex fixed bottom-0 items-center w-full bg-background h-navbar">
      <div className="mx-auto max-w-safe w-full">
        <button
          title="Open sidebar"
          onClick={uiDispatch.toggleSidebar}
          className="hidden justify-center items-center rounded-md transition-all lg:flex size-8 text-foreground/70 hover:text-foreground hover:bg-muted/30"
        >
          <SidebarIcon className="size-4" />
        </button>
        {vaultPath && (
          <span className="text-xs text-foreground/50 ml-2">{vaultPath}</span>
        )}
      </div>
    </footer>
  );
};
