import {
  ComponentsProvider,
  createTokenStyles,
  TokenRemap,
} from "@g4rcez/components";
import { createRoot } from "react-dom/client";
import {
  globalDispatch,
  globalState,
  repositories,
} from "../store/global.store";
import { Note } from "../store/note";
import { darkTheme } from "./styles/dark";
import { lightTheme } from "./styles/light";
import { router } from "./router";
import { StrictMode } from "react";
import { RouterProvider } from "react-router-dom";

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH: string;
  }
}

window.EXCALIDRAW_ASSET_PATH = "/";

const tweaks = {
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

export async function main() {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }
  initializePWA();
  try {
    const notes = await repositories.notes.getAll();
    globalDispatch.notes(notes);
    globalDispatch.loadTabs();
    const currentNoteId = globalState().note?.id;
    let noteToOpen: Note | null = null;
    if (currentNoteId) {
      noteToOpen = await repositories.notes.getOne(currentNoteId);
    }
    if (!noteToOpen && notes.length > 0) {
      noteToOpen = await repositories.notes.getOne(notes[0].id);
    }
    if (noteToOpen) {
      globalDispatch.note(noteToOpen);
    } else if (notes.length === 0) {
      const note = Note.new("Untitled", "# Hello world");
      await repositories.notes.save(note);
      globalDispatch.note(note);
    }
  } catch (error) {
    console.error("Failed to load notes:", error);
  }
  if (globalState().theme === "dark") {
    document.documentElement.classList.add("dark");
  }
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
  createRoot(rootElement).render(
    <StrictMode>
      <ComponentsProvider tweaks={tweaks}>
        <RouterProvider router={router} />
      </ComponentsProvider>
    </StrictMode>,
  );
}
