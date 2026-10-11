import type { Plugin } from "vite";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export function pdfAssets(): Plugin {
    const files = new Map<string, string>();
    return {
        name: "writeme-pdf-assets",
        async buildStart() {
            for (const directory of ["cmaps", "standard_fonts", "wasm"]) {
                const root = path.resolve("node_modules/pdfjs-dist", directory);
                for (const entry of await readdir(root)) {
                    files.set(`pdfjs/${directory}/${entry}`, path.join(root, entry));
                }
            }
        },
        configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
                const key = request.url?.split("?")[0]?.replace(/^\//, "") ?? "";
                const file = files.get(key);
                if (!file) return next();
                try {
                    const data = await readFile(file);
                    response.setHeader(
                        "Content-Type",
                        file.endsWith(".wasm") ? "application/wasm" : "application/octet-stream",
                    );
                    response.end(data);
                } catch (reason) {
                    next(reason);
                }
            });
        },
        async generateBundle() {
            await Promise.all(
                Array.from(files, async ([fileName, file]) => {
                    this.emitFile({ type: "asset", fileName, source: await readFile(file) });
                }),
            );
        },
    };
}
