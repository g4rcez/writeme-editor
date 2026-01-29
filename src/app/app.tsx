import { Brouther, Outlet } from "brouther";
import { StrictMode, useEffect } from "react";
import { Commander } from "./commander";
import { Layout } from "./components/layout";
import { DirectoryBrowserDialog } from "./components/directory-browser-dialog";
import { OpenProjectDialog } from "./components/open-project-dialog";
import { TabsBar } from "./components/tabs-bar";
import { PWAInstallButton } from "./elements/pwa-install-button";
import { Navbar } from "./navbar";
import { router } from "./router";
import { ShortcutsCommands } from "./tutorial/shortcuts-commands";
import { useGlobalStore, repositories } from "../store/global.store";
import { SettingsRepository } from "../store/settings";

export const App = () => {
  const [state, dispatch] = useGlobalStore();

  // Session restoration
  useEffect(() => {
    const restoreSession = async () => {
      const settings = SettingsRepository.load();
      if (!settings.storageDirectory) return;

      // Load tabs for current project
      await dispatch.loadTabs(settings.storageDirectory);

      // If there's an active tab, ensure its note is loaded
      if (state.activeTabId) {
        const tabs = await repositories.tabs.getAll(settings.storageDirectory);
        const activeTab = tabs.find((t) => t.id === state.activeTabId);
        if (activeTab) {
          const note = await repositories.notes.getOne(activeTab.noteId);
          if (note) {
            dispatch.setNote(note);
          }
        }
      }
    };
    restoreSession();
  }, []);

  return (
    <StrictMode>
      <Brouther config={router.config}>
        <div className="flex flex-col flex-1 h-full">
          <Commander />
          <Navbar />
          <TabsBar />
          <ShortcutsCommands />
          <DirectoryBrowserDialog />
          <OpenProjectDialog />
          <Layout className="flex flex-col gap-4 h-full pt-4">
            <Outlet />
          </Layout>
          <PWAInstallButton />
        </div>
      </Brouther>
    </StrictMode>
  );
};
