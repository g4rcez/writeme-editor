import { isElectron } from "../lib/is-electron";

interface IController {
  clipboard: () => Promise<string>;
}

class BrowserController implements IController {
  public constructor() { }

  public async clipboard() {
    const text = await navigator.clipboard.readText();
    return text;
  }
}

class NativeController implements IController {
  public async clipboard() {
    const content = await window.electronAPI.notes.clipboard();
    return content;
  }
}

export const controller = isElectron()
  ? new NativeController()
  : new BrowserController();
