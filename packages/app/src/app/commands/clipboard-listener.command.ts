import { COPY_EVENT_DISPATCHED, COPY_EVENT_STARTED } from "@/ipc/copy-event";
import { controller } from "../controller";
import { type ReplacerCommand } from "./commands";

let interval: null | NodeJS.Timeout = null;

let clipboardState: string | null = null;

export const ClipboardListenerCommand: ReplacerCommand = {
  find: />>copy $/,
  replace: () => {
    window.dispatchEvent(new CustomEvent(COPY_EVENT_STARTED));
    interval = setInterval(async () => {
      const content = await controller.clipboard();
      if (clipboardState === content) return;
      clipboardState = content;
      const event = new CustomEvent(COPY_EVENT_DISPATCHED, { detail: content });
      window.dispatchEvent(event);
    }, 500);
    return "";
  },
};

export const ClipboardCloseListenerCommand: ReplacerCommand = {
  find: />>endcopy $/,
  replace: () => {
    if (interval) {
      window.dispatchEvent(new CustomEvent(COPY_EVENT_STARTED));
      clearInterval(interval);
    }
    return "";
  },
};
