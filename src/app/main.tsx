import { createTheme } from "@g4rcez/components";
import { createRoot } from "react-dom/client";
import {
  globalDispatch,
  globalState,
  repositories,
} from "../store/global.store";
import { Note } from "../store/note";
import { App } from "./app";
import { darkTheme } from "./styles/dark";
import { lightTheme } from "./styles/light";

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH: string;
  }
}

window.EXCALIDRAW_ASSET_PATH = "/";

const createStyle = (id: string, innerText: string) =>
  Object.assign(document.createElement("style"), { id, innerText });

async function initializePWA() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("beforeinstallprompt", (e) => {
      (window as any).deferredPrompt = e;
      showInstallPromotion();
    });
    window.addEventListener("appinstalled", () => {
      (window as any).deferredPrompt = null;
    });
  }
}

function showInstallPromotion() {
  console.log(
    "PWA can be installed! Look for the install icon in your browser address bar.",
  );
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
    await globalDispatch.loadTabs();
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
      const note = Note.new("Untitled", "");
      await repositories.notes.save(note);
      globalDispatch.note(note);
    }
  } catch (error) {
    console.error("Failed to load notes:", error);
  }

  if (globalState().theme === "dark") {
    document.documentElement.classList.add("dark");
  }
  if (!rootElement.innerHTML) {
    const head = document.getElementsByTagName("head")[0]!;
    head.append(createStyle("default-theme", createTheme(lightTheme)));
    head.append(createStyle("dark-theme", createTheme(darkTheme, "dark")));
    createRoot(rootElement).render(<App />);
  }
}
