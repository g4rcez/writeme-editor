import { evaluateVimConfiguration } from "./evaluate";

self.onmessage = (event: MessageEvent<unknown>): void => {
    try {
        if (typeof event.data !== "string") throw new TypeError("Expected TypeScript source.");
        self.postMessage({ ok: true, configuration: evaluateVimConfiguration(event.data) });
    } catch (error) {
        self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
};

self.postMessage({ ready: true });
