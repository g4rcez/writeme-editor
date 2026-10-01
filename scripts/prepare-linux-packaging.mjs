import fs from "node:fs/promises";
import path from "node:path";

const supportedArchitecture =
    process.arch === "x64" || process.arch === "arm64" ? process.arch : null;

if (process.platform === "linux" && supportedArchitecture) {
    const prebuildsPath = path.resolve("node_modules/better-sqlite3/prebuilds");
    const prebuilds = await fs.readdir(prebuildsPath);

    await Promise.all(
        prebuilds
            .filter(
                (filename) =>
                    filename.endsWith(".node") && !filename.endsWith(`-${supportedArchitecture}.node`),
            )
            .map((filename) => fs.rm(path.join(prebuildsPath, filename), { force: true })),
    );
}
