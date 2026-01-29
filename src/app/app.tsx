import { Brouther, Outlet } from "brouther";
import { StrictMode } from "react";
import { Commander } from "./commander";
import { Layout } from "./components/layout";
import { DirectoryBrowserDialog } from "./components/directory-browser-dialog";
import { OpenProjectDialog } from "./components/open-project-dialog";
import { PWAInstallButton } from "./elements/pwa-install-button";
import { Navbar } from "./navbar";
import { router } from "./router";
import { ShortcutsCommands } from "./tutorial/shortcuts-commands";

export const App = () => {
  return (
    <StrictMode>
      <Brouther config={router.config}>
        <div className="flex flex-col flex-1 gap-4 h-full">
          <Commander />
          <Navbar />
          <ShortcutsCommands />
          <DirectoryBrowserDialog />
          <OpenProjectDialog />
          <Layout className="flex flex-col gap-4 h-full">
            <Outlet />
          </Layout>
          <PWAInstallButton />
        </div>
      </Brouther>
    </StrictMode>
  );
};
