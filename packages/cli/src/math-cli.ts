#!/usr/bin/env node
import { handleMathRepl } from "./commands/math.ts";

try {
    await handleMathRepl();
} catch (err: unknown) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
}
