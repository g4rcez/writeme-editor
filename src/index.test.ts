import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

describe("renderer component stylesheets", () => {
    it("exports every stylesheet imported from the component package", () => {
        const stylesheet = readFileSync("src/index.css", "utf8");
        const imports = stylesheet.match(/@g4rcez\/components\/[^"]+\.css/g) ?? [];

        expect(imports).toContain("@g4rcez/components/foundation.css");
        for (const specifier of imports) {
            expect(statSync(require.resolve(specifier)).isFile(), specifier).toBe(true);
        }
    });
});
