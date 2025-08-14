import { createTheme } from "@g4rcez/components";
import { createRoot } from "react-dom/client";
import { globalDispatch, repositories } from "../store/global.store";
import { Editor } from "./editor";
import { darkTheme } from "./styles/dark";
import { lightTheme } from "./styles/light";
import { StrictMode } from "react";
import { Note } from "../store/note";

const createStyle = (id: string, innerText: string) =>
  Object.assign(document.createElement("style"), { id, innerText });

async function main() {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }
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
    root.render(
      <StrictMode>
        <Editor />
      </StrictMode>,
    );
  }
}

main();
