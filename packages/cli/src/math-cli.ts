#!/usr/bin/env node
import { handleMathRepl } from "./commands/math.ts";

try {
    await handleMathRepl();
} catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
