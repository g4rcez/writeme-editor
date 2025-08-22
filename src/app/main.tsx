import { createTheme } from "@g4rcez/components";
import { createRoot } from "react-dom/client";
import { globalDispatch, repositories } from "../store/global.store";
import { Note } from "../store/note";
import { App } from "./app";
import { darkTheme } from "./styles/dark";
import { lightTheme } from "./styles/light";

const createStyle = (id: string, innerText: string) =>
  Object.assign(document.createElement("style"), { id, innerText });

function initializePWA() {
  if ("serviceWorker" in navigator) {
    console.log("PWA service worker support detected");
    window.addEventListener("beforeinstallprompt", (e) => {
      console.log("PWA install prompt available");
      // Store the event for later use
      (window as any).deferredPrompt = e;
    });
  }
}

export async function main() {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }
  initializePWA();
  const notes = await repositories.notes.getAll();
  if (notes.length === 0) {
    const note = Note.new("Untitled", "");
    await repositories.notes.save(note);
    globalDispatch.note(note);
  } else {
    globalDispatch.note(notes.at(-1));
  }
  if (!rootElement.innerHTML) {
    globalDispatch.theme("dark");
    const head = document.getElementsByTagName("head")[0]!;
    head.append(createStyle("default-theme", createTheme(lightTheme)));
    head.append(createStyle("dark-theme", createTheme(darkTheme, "dark")));
    const root = createRoot(rootElement);
    root.render(<App />);
  }
}
