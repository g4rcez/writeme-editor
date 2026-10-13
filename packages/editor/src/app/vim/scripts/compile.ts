import { z } from "zod";
import { requireFeature } from "@/lib/build-features";
import { VimConfigurationSchema, type VimConfiguration } from "../configuration";
import { VimConfigurationError } from "../configuration-error";

const ReplySchema = z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), configuration: VimConfigurationSchema }),
    z.object({ ok: z.literal(false), error: z.string() }),
]);
const ReadySchema = z.object({ ready: z.literal(true) });

export function compileVimConfiguration(source: string): Promise<VimConfiguration> {
    requireFeature("vimScripts");
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL("./configuration.worker.ts", import.meta.url), { type: "module" });
        let started = false;
        const finish = (): void => {
            clearTimeout(timeout);
            worker.terminate();
        };
        let timeout = setTimeout(() => {
            finish();
            reject(new VimConfigurationError("Unable to start the init.ts worker. Please try saving again."));
        }, 15_000);
        worker.onmessage = (event: MessageEvent<unknown>): void => {
            if (!started && ReadySchema.safeParse(event.data).success) {
                started = true;
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    finish();
                    reject(new VimConfigurationError("init.ts took too long to finish. Check for an endless loop."));
                }, 3000);
                worker.postMessage(source);
                return;
            }
            finish();
            const reply = ReplySchema.safeParse(event.data);
            if (!reply.success) {
                reject(new VimConfigurationError("Invalid init.ts worker response."));
                return;
            }
            switch (reply.data.ok) {
                case true:
                    resolve(reply.data.configuration);
                    break;
                case false:
                    reject(new VimConfigurationError(reply.data.error));
                    break;
            }
        };
        worker.onerror = (event): void => {
            finish();
            reject(new VimConfigurationError(event.message || "Unable to load the init.ts worker."));
        };
    });
}
