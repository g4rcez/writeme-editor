import {
  ComponentsProvider,
  createTokenStyles,
  TokenRemap,
  Modal,
  Tweaks,
} from "@g4rcez/components";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import {
  globalDispatch,
  globalState,
  repositories,
} from "../store/global.store";
import { router } from "./router";
import { darkTheme } from "./styles/dark";
import { lightTheme } from "./styles/light";
import { migrateDexieToSqlite } from "../lib/dexie-to-sqlite-migration";
import { SettingsService } from "../store/settings";
import { sortByNewest } from "@/lib/array";

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH: string;
  }
}

window.EXCALIDRAW_ASSET_PATH = "/";

const tweaks: Tweaks = {
  input: { iconFeedback: false },
  table: { sticky: 87, filters: false, sorters: false, operations: false },
};

const createStyle = (id: string, innerText: string) =>
  Object.assign(document.createElement("style"), { id, innerText });

const tokenRemap: TokenRemap = {
  colors: (t) => {
    t.value = t.value.replace("hsla(", "").replace(/\)$/, "");
    return t;
  },
};

async function initializePWA() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("beforeinstallprompt", (e) => {
      (window as any).deferredPrompt = e;
      console.log(
        "PWA can be installed! Look for the install icon in your browser address bar.",
      );
    });
    window.addEventListener("appinstalled", () => {
      (window as any).deferredPrompt = null;
    });
  }
}

const themeConfiguration = () => {
  const head = document.getElementsByTagName("head")[0]!;
  head.append(
    createStyle("default-theme", createTokenStyles(lightTheme, tokenRemap)),
  );
  head.append(
    createStyle(
      "dark-theme",
      createTokenStyles(darkTheme, {
        ...tokenRemap,
        name: "dark",
      }),
    ),
  );
  if (globalState().theme === "dark") {
    document.documentElement.classList.add("dark");
  }
};

export async function main() {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }
  themeConfiguration();
  // initializePWA();
  try {
    await SettingsService.init();
    const settings = SettingsService.load();
    await migrateDexieToSqlite();
    const notes = await repositories.notes.getAll();
    const tabs = await repositories.tabs.getAll();
    globalDispatch.init(settings.theme, notes, tabs);
    const tab = sortByNewest(tabs)[0];
    const find = notes.find((x) => x.id === tab?.id);
    if (find) {
      const note = await repositories.notes.getOne(notes[0].id);
      globalDispatch.note(note);
    }
  } catch (error) {
    console.error("Failed to load notes:", error);
  }
  createRoot(rootElement).render(
    <StrictMode>
      <ComponentsProvider tweaks={tweaks}>
        <RouterProvider router={router} />
      </ComponentsProvider>
    </StrictMode>,
  );
}
