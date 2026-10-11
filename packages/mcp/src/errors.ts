import { z, ZodError } from "zod";
import { CONTRACT_VERSION } from "./api.js";
import { ReaderError } from "./contracts.js";

export const errorCodeSchema = z.enum([
    "DATABASE_NOT_FOUND",
    "DATABASE_BUSY",
    "DATABASE_READ_FAILED",
    "READER_CLOSED",
    "INCOMPATIBLE_SCHEMA",
    "INVALID_SETTINGS",
    "WORKSPACE_NOT_FOUND",
    "NOT_FOUND",
    "CONTENT_UNAVAILABLE",
    "INVALID_ARGUMENT",
    "AMBIGUOUS_SECTION",
    "INVALID_DOCUMENT",
    "UNAVAILABLE",
    "READ_FAILED",
    "INVALID_RESPONSE",
    "REVISION_MISMATCH",
]);
export type ToolErrorCode = z.infer<typeof errorCodeSchema>;
export const toolErrorSchema = z.object({
    contractVersion: z.literal(CONTRACT_VERSION),
    error: z.object({
        code: errorCodeSchema,
        message: z.string(),
        retryable: z.boolean(),
        details: z
            .object({
                issues: z.array(
                    z.object({ path: z.array(z.union([z.string(), z.number()])), code: z.string() }),
                ),
            })
            .optional(),
    }),
});
export type ToolError = z.infer<typeof toolErrorSchema>;

export function toToolError(error: unknown): ToolError {
    if (error instanceof ZodError) {
        return {
            contractVersion: CONTRACT_VERSION,
            error: {
                code: "INVALID_ARGUMENT",
                message: "Tool arguments do not match the public input schema",
                retryable: false,
                details: {
                    issues: error.issues.map((issue) => ({
                        path: issue.path.filter(
                            (part): part is string | number =>
                                typeof part === "string" || typeof part === "number",
                        ),
                        code: issue.code,
                    })),
                },
            },
        };
    }
    if (error instanceof ReaderError) {
        const code = errorCodeSchema.safeParse(error.code);
        if (code.success)
            return {
                contractVersion: CONTRACT_VERSION,
                error: { code: code.data, message: error.message, retryable: code.data === "DATABASE_BUSY" },
            };
    }
    return {
        contractVersion: CONTRACT_VERSION,
        error: { code: "READ_FAILED", message: "Unable to read the saved workspace", retryable: false },
    };
}
