import { chmod } from "node:fs/promises";

await Promise.all(["dist/index.js", "dist/math-cli.js"].map((file) => chmod(file, 0o755)));
