import { createTheme } from "@g4rcez/components";
import { createRoot } from "react-dom/client";
import { globalDispatch, globalState, repositories } from "../store/global.store";
import { Note } from "../store/note";
import { App } from "./app";
import { darkTheme } from "./styles/dark";
import { lightTheme } from "./styles/light";

const createStyle = (id: string, innerText: string) =>
  Object.assign(document.createElement("style"), { id, innerText });

async function initializePWA() {
  if ("serviceWorker" in navigator) {
    console.log("PWA service worker support detected");
    window.addEventListener("beforeinstallprompt", (e) => {
      console.log("PWA install prompt available");
      // e.preventDefault();
      (window as any).deferredPrompt = e;
      showInstallPromotion();
    });
    window.addEventListener("appinstalled", () => {
      console.log("PWA was installed");
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
  const notes = await repositories.notes.getAll();
  if (notes.length === 0) {
    const note = Note.new("Untitled", "");
    await repositories.notes.save(note);
    globalDispatch.note(note);
  } else {
    globalDispatch.note(notes.at(-1));
  }
  if (globalState().theme === "dark") { 
    document.documentElement.classList.add("dark");
  }
  if (!rootElement.innerHTML) {
    const head = document.getElementsByTagName("head")[0]!;
    head.append(createStyle("default-theme", createTheme(lightTheme)));
    head.append(createStyle("dark-theme", createTheme(darkTheme, "dark")));
    const root = createRoot(rootElement);
    root.render(<App />);
  }
}
