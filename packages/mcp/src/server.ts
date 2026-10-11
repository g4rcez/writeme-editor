import { McpServer, ProtocolError, ProtocolErrorCode, ResourceTemplate } from "@modelcontextprotocol/server";
import { ReaderError, type WorkspaceReader } from "./contracts.js";
import { readTool } from "./tools/read.js";
import {
    SERVER_VERSION,
    toolNames,
    toolSchemas,
    toolOutputSchemas,
    toolDescriptions,
    readOnlyAnnotations,
    type ToolName,
} from "./api.js";
import { toToolError } from "./errors.js";

async function readResponse(
    reader: WorkspaceReader,
    name: ToolName,
    args: unknown,
): Promise<Record<string, unknown>> {
    const result = await readTool(reader, name, args);
    const validated = toolOutputSchemas[name].safeParse(result);
    if (!validated.success)
        throw new ReaderError("INVALID_RESPONSE", "Saved response does not match the public output schema");
    return validated.data;
}

async function readResourceResponse(
    reader: WorkspaceReader,
    name: ToolName,
    args: unknown,
): Promise<Record<string, unknown>> {
    try {
        return await readResponse(reader, name, args);
    } catch (error) {
        const envelope = toToolError(error);
        throw new ProtocolError(ProtocolErrorCode.InternalError, envelope.error.message, envelope);
    }
}

export function createServer(reader: WorkspaceReader): McpServer {
    const server = new McpServer({ name: "writeme", version: SERVER_VERSION });
    const invoke = async (name: ToolName, args: unknown) => {
        try {
            const result = await readResponse(reader, name, args);
            return {
                content: [{ type: "text" as const, text: JSON.stringify(result) }],
                structuredContent: result,
            };
        } catch (error) {
            const result = toToolError(error);
            return {
                isError: true,
                content: [{ type: "text" as const, text: JSON.stringify(result) }],
                structuredContent: result,
            };
        }
    };
    for (const name of toolNames) {
        server.registerTool(
            name,
            {
                description: toolDescriptions[name],
                inputSchema: toolSchemas[name],
                outputSchema: toolOutputSchemas[name],
                annotations: readOnlyAnnotations,
            },
            async (args: Record<string, unknown>) => invoke(name, args),
        );
    }
    // The SDK's default validation errors contain only text and may echo inputs.
    // Validate in the same invocation boundary to return the public error envelope.
    server.server.setRequestHandler("tools/call", async (request) => {
        const name = toolNames.find((entry) => entry === request.params.name);
        if (!name) throw new ProtocolError(ProtocolErrorCode.InvalidParams, "Unknown Writeme tool");
        return server.server.projectCallToolResult(
            await invoke(name, request.params.arguments ?? {}),
            undefined,
        );
    });
    server.registerResource(
        "workspace",
        "writeme://workspace",
        {
            mimeType: "application/json",
            description: "Selected saved workspace and capabilities",
        },
        async (uri) => ({
            contents: [
                {
                    uri: uri.href,
                    mimeType: "application/json",
                    text: JSON.stringify(await readResourceResponse(reader, "get_workspace", {})),
                },
            ],
        }),
    );
    server.registerResource(
        "note",
        new ResourceTemplate("writeme://notes/{ref}", { list: undefined }),
        {
            mimeType: "application/json",
            description: "Saved note metadata and first sanitized content chunk. Continue through get_note.",
        },
        async (uri, variables) => {
            const value = variables.ref;
            if (typeof value !== "string")
                throw new ReaderError("INVALID_ARGUMENT", "Expected one encoded note reference");
            let reference: string;
            try {
                reference = decodeURIComponent(value);
            } catch {
                throw new ReaderError("INVALID_ARGUMENT", "Malformed note reference");
            }
            return {
                contents: [
                    {
                        uri: uri.href,
                        mimeType: "application/json",
                        text: JSON.stringify(
                            await readResourceResponse(reader, "get_note", {
                                ref: reference,
                                format: "content",
                            }),
                        ),
                    },
                ],
            };
        },
    );
    return server;
}
