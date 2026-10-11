import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import {
    CONTRACT_VERSION,
    readOnlyAnnotations,
    toolNames,
    toolOutputSchemas,
    toolSchemas,
} from "../src/api.js";
import { toolErrorSchema } from "../src/errors.js";

const baseline = new URL("../contract/v1.json", import.meta.url);
function machineSchema(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(machineSchema);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
        Object.entries(value)
            .filter(([key]) => !["description", "title", "examples", "$comment"].includes(key))
            .map(([key, entry]) => [
                key,
                ["properties", "$defs", "definitions", "patternProperties", "dependentSchemas"].includes(
                    key,
                ) &&
                entry &&
                typeof entry === "object"
                    ? Object.fromEntries(
                          Object.entries(entry).map(([property, schema]) => [
                              property,
                              machineSchema(schema),
                          ]),
                      )
                    : ["default", "const", "enum"].includes(key)
                      ? entry
                      : machineSchema(entry),
            ]),
    );
}
const manifest = {
    contractVersion: CONTRACT_VERSION,
    tools: Object.fromEntries(
        toolNames.map((name) => [
            name,
            {
                inputSchema: {
                    type: "object",
                    ...z.toJSONSchema(toolSchemas[name], {
                        target: "draft-2020-12",
                        io: "input",
                    }),
                },
                outputSchema: {
                    type: "object",
                    ...z.toJSONSchema(toolOutputSchemas[name], {
                        target: "draft-2020-12",
                        io: "output",
                    }),
                },
                annotations: readOnlyAnnotations,
            },
        ]),
    ),
    resources: {
        workspace: "writeme://workspace",
        note: "writeme://notes/{ref}",
    },
    errorSchema: z.toJSONSchema(toolErrorSchema, {
        target: "draft-2020-12",
        io: "output",
    }),
};
const rendered = `${JSON.stringify(machineSchema(manifest), null, 4)}\n`;
const mode = process.argv[2];
if (mode === "--write") {
    await mkdir(dirname(fileURLToPath(baseline)), { recursive: true });
    await writeFile(baseline, rendered);
    console.log("Updated contract/v1.json. Review its diff and compatibility before committing.");
} else if (mode === "--check") {
    if (
        JSON.stringify(machineSchema(JSON.parse(await readFile(baseline, "utf8")))) !==
        JSON.stringify(machineSchema(manifest))
    ) {
        console.error(
            "Public contract changed. Review compatibility and CONTRACT.md before explicitly updating the baseline.",
        );
        process.exitCode = 1;
    } else console.log("Public contract matches contract/v1.json.");
} else {
    console.error("Usage: bun scripts/contract.ts --check|--write");
    process.exitCode = 1;
}
