import { z } from "zod";
import type { JsonValue } from "./contracts.js";
import packageInfo from "../package.json" with { type: "json" };

export const CONTRACT_VERSION = "1.0";
export const SERVER_VERSION = packageInfo.version;

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
    z.union([
        z.null(),
        z.boolean(),
        z.number().finite(),
        z.string(),
        z.array(jsonValueSchema),
        z.record(z.string(), jsonValueSchema),
    ]),
);
const identifier = z.string().min(1).max(4096);
const nonnegativeInteger = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const pagination = {
    offset: nonnegativeInteger.default(0),
    limit: z.number().int().min(1).max(200).default(50),
    expectedRevision: identifier.optional(),
};
const pageInput = z.strictObject(pagination);
const filters = {
    query: z.string().max(1000).optional(),
    tag: z.string().max(4096).optional(),
    project: z.string().max(4096).optional(),
    noteType: z.string().max(4096).optional(),
    favorite: z.boolean().optional(),
    folder: z.string().max(4096).optional(),
};
const noteInputShape = {
    ...pagination,
    ref: identifier,
    raw: z.boolean().default(false),
    contentOffset: nonnegativeInteger.default(0),
    contentLimit: z.number().int().min(1).max(64000).default(16000),
};
export const toolSchemas = {
    get_status: pageInput,
    get_workspace: pageInput,
    list_notes: z.strictObject({ ...pagination, ...filters }),
    search_notes: z.strictObject({ ...pagination, ...filters, query: z.string().min(1).max(1000) }),
    get_note: z.union([
        z.strictObject({
            ...noteInputShape,
            format: z.literal("section"),
            section: z.string().min(1).max(4096),
        }),
        z.strictObject({
            ...noteInputShape,
            format: z
                .enum(["metadata", "metadata_json", "content", "outline", "excalidraw"])
                .default("metadata"),
            section: z.string().min(1).max(4096).optional(),
        }),
    ]),
    list_tags: pageInput,
    get_note_links: z.strictObject({ ...pagination, ref: identifier }),
    get_settings: pageInput,
    list_projects: pageInput,
    list_groups: pageInput,
    get_group: z.strictObject({ ...pagination, id: identifier }),
    list_views: pageInput,
    get_view: z.strictObject({ ...pagination, id: identifier }),
    list_tabs: pageInput,
    list_templates: z.strictObject({ ...pagination, ...filters }),
    get_comments: z.strictObject({ ...pagination, ref: identifier }),
};
export type ToolName = keyof typeof toolSchemas;
export type ToolArgs<Name extends ToolName> = z.infer<(typeof toolSchemas)[Name]>;
export type ToolRequest = { [Name in ToolName]: { name: Name; args: ToolArgs<Name> } }[ToolName];
export const toolNames = [
    "get_status",
    "get_workspace",
    "list_notes",
    "search_notes",
    "get_note",
    "list_tags",
    "get_note_links",
    "get_settings",
    "list_projects",
    "list_groups",
    "get_group",
    "list_views",
    "get_view",
    "list_tabs",
    "list_templates",
    "get_comments",
] satisfies ToolName[];

export function parseToolRequest(name: ToolName, input: unknown): ToolRequest {
    switch (name) {
        case "get_status":
            return { name, args: toolSchemas.get_status.parse(input) };
        case "get_workspace":
            return { name, args: toolSchemas.get_workspace.parse(input) };
        case "list_notes":
            return { name, args: toolSchemas.list_notes.parse(input) };
        case "search_notes":
            return { name, args: toolSchemas.search_notes.parse(input) };
        case "get_note":
            return { name, args: toolSchemas.get_note.parse(input) };
        case "list_tags":
            return { name, args: toolSchemas.list_tags.parse(input) };
        case "get_note_links":
            return { name, args: toolSchemas.get_note_links.parse(input) };
        case "get_settings":
            return { name, args: toolSchemas.get_settings.parse(input) };
        case "list_projects":
            return { name, args: toolSchemas.list_projects.parse(input) };
        case "list_groups":
            return { name, args: toolSchemas.list_groups.parse(input) };
        case "get_group":
            return { name, args: toolSchemas.get_group.parse(input) };
        case "list_views":
            return { name, args: toolSchemas.list_views.parse(input) };
        case "get_view":
            return { name, args: toolSchemas.get_view.parse(input) };
        case "list_tabs":
            return { name, args: toolSchemas.list_tabs.parse(input) };
        case "list_templates":
            return { name, args: toolSchemas.list_templates.parse(input) };
        case "get_comments":
            return { name, args: toolSchemas.get_comments.parse(input) };
        default: {
            const exhaustive: never = name;
            throw new Error(`Unknown tool: ${exhaustive}`);
        }
    }
}

export const paginationOutputShape = {
    total: nonnegativeInteger,
    offset: nonnegativeInteger,
    nextOffset: nonnegativeInteger.nullable(),
    complete: z.boolean(),
};
export function pageOutputSchema<Item extends z.ZodType>(item: Item) {
    return z.object({ items: z.array(item).max(200), ...paginationOutputShape }).catchall(jsonValueSchema);
}
export const contentChunkSchema = z
    .object({
        text: z.string().max(64000),
        totalCharacters: nonnegativeInteger,
        offset: nonnegativeInteger,
        nextOffset: nonnegativeInteger.nullable(),
        complete: z.boolean(),
    })
    .catchall(jsonValueSchema);
export const headingSchema = z
    .object({
        text: z.string(),
        level: z.number().int().min(1).max(6),
        offset: nonnegativeInteger,
        end: nonnegativeInteger,
    })
    .catchall(jsonValueSchema);
const rootKind = z.enum(["workspace", "templates", "quicknotes"]);
const storageMode = z.enum(["database", "filesystem"]);
const capabilitySchema = z.record(z.string(), z.boolean());
const summaryShape = {
    id: z.string().nullable(),
    ref: z.string(),
    path: z.string().nullable(),
    root: rootKind.nullable(),
    title: z.string(),
    noteType: z.string(),
    tags: z.array(z.string()),
    favorite: z.boolean(),
    project: z.string(),
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
    metadata: z.record(z.string(), jsonValueSchema),
    source: z.enum(["sqlite", "filesystem"]),
    revision: z.string().nullable(),
    error: z.string().optional(),
};
export const noteSummarySchema = z.object(summaryShape).catchall(jsonValueSchema);
export type NoteSummary = z.infer<typeof noteSummarySchema>;
export const collectionRecordSchema = z.object({ id: z.string() }).catchall(jsonValueSchema);
export const successEnvelopeShape = {
    contractVersion: z.literal(CONTRACT_VERSION),
    snapshotRevision: z.string(),
    source: z.enum(["saved", "sqlite", "filesystem"]),
    revision: z.string(),
    observedAt: z.iso.datetime({ offset: true }),
    snapshotComplete: z.boolean(),
    complete: z.boolean(),
    truncated: z.boolean().optional(),
    truncation: z.string().optional(),
};
const notePage = pageOutputSchema(noteSummarySchema);
const recordPage = pageOutputSchema(collectionRecordSchema);
const fullNoteOutput = noteSummarySchema.extend({
    ...successEnvelopeShape,
    source: summaryShape.source,
    revision: summaryShape.revision,
});
const noteOutput = z.discriminatedUnion("responseFormat", [
    fullNoteOutput.extend({ responseFormat: z.literal("metadata") }),
    z
        .object({
            ...successEnvelopeShape,
            revision: summaryShape.revision,
            ref: z.string(),
            responseFormat: z.literal("metadata_json"),
            content: contentChunkSchema,
        })
        .catchall(jsonValueSchema),
    fullNoteOutput.extend({
        responseFormat: z.literal("content"),
        content: contentChunkSchema,
        raw: z.boolean(),
        sanitized: z.boolean(),
    }),
    fullNoteOutput.extend({ responseFormat: z.literal("outline"), outline: pageOutputSchema(headingSchema) }),
    fullNoteOutput.extend({
        responseFormat: z.literal("section"),
        section: headingSchema,
        content: contentChunkSchema,
    }),
    fullNoteOutput.extend({
        responseFormat: z.literal("excalidraw"),
        document: jsonValueSchema,
        elements: pageOutputSchema(jsonValueSchema),
        embeddedFilesOmitted: z.boolean(),
    }),
]);
const commentSchema = z
    .object({
        threadId: z.string(),
        quote: jsonValueSchema,
        commentIndex: nonnegativeInteger,
        body: jsonValueSchema,
    })
    .catchall(jsonValueSchema);
export const toolOutputSchemas = {
    get_status: z
        .object({
            ...successEnvelopeShape,
            profile: z.enum(["production", "development"]),
            storageMode,
            capabilities: capabilitySchema,
            warnings: pageOutputSchema(z.string()),
        })
        .catchall(jsonValueSchema),
    get_workspace: z
        .object({
            ...successEnvelopeShape,
            workspace: z.string().nullable(),
            storageMode,
            roots: pageOutputSchema(z.object({ kind: rootKind, path: z.string() }).catchall(jsonValueSchema)),
            capabilities: capabilitySchema,
            noteCount: nonnegativeInteger,
        })
        .catchall(jsonValueSchema),
    list_notes: notePage.extend(successEnvelopeShape),
    search_notes: notePage.extend(successEnvelopeShape),
    get_note: noteOutput,
    list_tags: pageOutputSchema(z.string()).extend(successEnvelopeShape),
    get_note_links: z
        .object({
            ...successEnvelopeShape,
            ref: z.string(),
            backlinksComplete: z.boolean(),
            outgoing: pageOutputSchema(
                z.object({ href: z.string(), ref: z.string().nullable() }).catchall(jsonValueSchema),
            ),
            backlinks: notePage,
        })
        .catchall(jsonValueSchema),
    get_settings: pageOutputSchema(
        z
            .object({ key: z.string(), value: jsonValueSchema, description: z.string() })
            .catchall(jsonValueSchema),
    ).extend(successEnvelopeShape),
    list_projects: recordPage.extend(successEnvelopeShape),
    list_groups: recordPage.extend(successEnvelopeShape),
    get_group: z
        .object({ ...successEnvelopeShape, record: collectionRecordSchema, members: recordPage })
        .catchall(jsonValueSchema),
    list_views: recordPage.extend(successEnvelopeShape),
    get_view: z.object({ ...successEnvelopeShape, record: collectionRecordSchema }).catchall(jsonValueSchema),
    list_tabs: recordPage.extend({ ...successEnvelopeShape, live: z.literal(false) }),
    list_templates: notePage.extend(successEnvelopeShape),
    get_comments: pageOutputSchema(commentSchema).extend({
        ...successEnvelopeShape,
        ref: z.string(),
        companionRef: z.string().nullable(),
    }),
} satisfies Record<ToolName, z.ZodType>;
export type ToolOutput<Name extends ToolName> = z.infer<(typeof toolOutputSchemas)[Name]>;

export const readOnlyAnnotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
};
const pagingDescription =
    "Saved state only. Paginate with offset/limit (default 50, max 200). Pass expectedRevision equal to the prior snapshotRevision to require the same saved snapshot.";
export const toolDescriptions: Record<ToolName, string> = {
    get_status: `Read profile, availability and capabilities. Live editor state is unavailable. ${pagingDescription}`,
    get_workspace: `Read the selected workspace, roots and saved note count. ${pagingDescription}`,
    list_notes: `List saved note summaries filtered by query, tag, project, type, favorite or folder. ${pagingDescription}`,
    search_notes: `Search saved titles and content using a literal case-insensitive query. ${pagingDescription}`,
    get_note:
        "Read a UUID or exact root-prefixed note ref. Default metadata; formats metadata_json/content/outline/section/excalidraw. Section requires a unique heading. raw:true preserves canonical saved content. Content uses contentOffset/contentLimit (default 16000, max 64000); arrays use offset/limit. expectedRevision compares the prior snapshotRevision (not the note content revision). responseFormat identifies the returned representation; raw drawings return content. Embedded assets are omitted unless raw content is requested.",
    list_tags: `List unique saved note tags. ${pagingDescription}`,
    get_note_links: `Read scoped Markdown/wiki outgoing links and backlinks. ${pagingDescription}`,
    get_settings: `Read saved preference keys, values and descriptions. ${pagingDescription}`,
    list_projects: `List saved projects. ${pagingDescription}`,
    list_groups: `List saved groups. ${pagingDescription}`,
    get_group: `Read a saved group and page its membership. ${pagingDescription}`,
    list_views: `List saved views. ${pagingDescription}`,
    get_view: `Read a saved view by ID. ${pagingDescription}`,
    list_tabs: `List tabs in persisted order; these are not live editor tabs. ${pagingDescription}`,
    list_templates: `List saved template summaries using note filters. ${pagingDescription}`,
    get_comments: `Read comments from the source note's saved companion. ${pagingDescription}`,
};
