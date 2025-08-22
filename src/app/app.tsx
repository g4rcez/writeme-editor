import { Brouther, Outlet } from "brouther";
import { StrictMode } from "react";
import { Commander } from "./commander";
import { Navbar } from "./navbar";
import { router } from "./router";
import { ShortcutsCommands } from "./tutorial/shortcuts-commands";

export const App = () => {
  return (
    <StrictMode>
      <Brouther config={router.config}>
        <div className="flex flex-col flex-1 gap-8 h-full">
          <Commander />
          <Navbar />
          <ShortcutsCommands />
          <div className="container flex px-8 mx-auto w-full max-w-5xl h-full lg:px-0">
            <Outlet />
          </div>
        </div>
      </Brouther>
    </StrictMode>
  );
};
