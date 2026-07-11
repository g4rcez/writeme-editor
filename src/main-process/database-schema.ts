import { v7 as uuid } from "uuid";
import { z } from "zod";

const text = z.string().nullable().optional();
const date = z.union([z.string(), z.date()]).nullable().optional();
const number = z.number().nullable().optional();
const boolean = z.boolean().optional();

const withId = <T extends z.ZodRawShape>(shape: T) => z.object({ id: z.string().optional(), ...shape });

export const databaseSchemas = {
    notes: withId({
        type: text,
        title: text,
        project: text,
        filePath: text,
        tags: z.array(z.string()).optional(),
        createdAt: date,
        updatedAt: date,
        createdBy: text,
        updatedBy: text,
        content: text,
        noteType: text,
        fileSize: number,
        lastSynced: date,
        url: text,
        description: text,
        favicon: text,
        metadata: z.record(z.string(), z.unknown()).nullable().optional(),
        favorite: boolean,
        deletedAt: date,
        originalFilePath: text,
    }),
    projects: withId({
        type: text,
        title: text,
        name: text,
        folderPath: text,
        description: text,
        createdAt: date,
        updatedAt: date,
    }),
    tabs: withId({
        type: text,
        noteId: text,
        order: number,
        project: text,
        createdAt: date,
        updatedAt: date,
        scrollY: number,
    }),
    terminalSessions: withId({
        type: text,
        title: text,
        project: text,
        createdAt: date,
        updatedAt: date,
    }),
    hashtags: withId({
        type: text,
        hashtag: text,
        filename: text,
        project: text,
        createdAt: date,
        updatedAt: date,
    }),
    settings: withId({
        type: text,
        name: z.string(),
        value: text,
        createdAt: date,
        updatedAt: date,
    }),
    aiConfigs: withId({
        type: text,
        name: text,
        commandTemplate: text,
        systemPrompt: text,
        isDefault: boolean,
        adapterId: text,
        model: text,
        baseUrl: text,
        createdAt: date,
        updatedAt: date,
    }),
    aiChats: withId({
        type: text,
        noteId: text,
        title: text,
        createdAt: date,
        updatedAt: date,
    }),
    aiMessages: withId({
        type: text,
        chatId: text,
        role: z.enum(["user", "assistant", "system"]).optional(),
        content: text,
        diffOriginal: text,
        diffNew: text,
        selectionSlice: z.object({ from: z.number(), to: z.number() }).nullable().optional(),
        files: z
            .array(
                z.object({
                    id: z.string(),
                    name: z.string(),
                    mimeType: z.string(),
                    size: z.number(),
                }),
            )
            .optional(),
        createdAt: date,
        updatedAt: date,
    }),
    scripts: withId({
        type: text,
        name: text,
        content: text,
        createdAt: date,
        updatedAt: date,
    }),
    noteGroups: withId({
        type: text,
        title: text,
        description: text,
        createdAt: date,
        updatedAt: date,
    }),
    noteGroupMembers: withId({
        type: text,
        groupId: text,
        noteId: text,
        order: number,
        createdAt: date,
        updatedAt: date,
    }),
    views: withId({
        type: text,
        title: text,
        query: text,
        columns: z
            .array(
                z.object({
                    field: z.string(),
                    label: z.string(),
                    width: z.number().optional(),
                }),
            )
            .optional(),
        viewType: z.enum(["table", "kanban", "calendar"]).optional(),
        sortField: text,
        sortDirection: z.enum(["ASC", "DESC"]).optional(),
        viewConfig: z.record(z.string(), z.unknown()).optional(),
        createdAt: date,
        updatedAt: date,
    }),
    cursorPositions: withId({
        noteId: z.string(),
        anchor: number,
        y: number,
        updatedAt: z.number().optional(),
    }),
} as const;

export const aiCredentialsSchema = z.object({
    adapterId: z.string(),
    accessToken: text,
    refreshToken: text,
    expiresAt: z.number().optional(),
    apiKey: text,
    baseUrl: text,
    accountId: text,
    idToken: text,
    createdAt: date,
    updatedAt: date,
});

export function parseAiCredentials(value: unknown): z.infer<typeof aiCredentialsSchema> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("Invalid aiCredentials record");
    }
    const input = value as Record<string, unknown>;
    const parsed = aiCredentialsSchema.parse(input);
    const unknown = Object.keys(input).filter((key) => !(key in aiCredentialsSchema.shape));
    if (unknown.length) {
        console.warn(`Stripped unknown aiCredentials fields: ${unknown.join(", ")}`);
    }
    return parsed;
}

export type DatabaseCollection = keyof typeof databaseSchemas;
export type DatabaseRecord<C extends DatabaseCollection = DatabaseCollection> = z.output<
    (typeof databaseSchemas)[C]
> & { id: string };

export function isDatabaseCollection(value: string): value is DatabaseCollection {
    return Object.hasOwn(databaseSchemas, value);
}

export function parseDatabaseRecord<C extends DatabaseCollection>(
    collection: C,
    value: unknown,
    warn: (message: string) => void = console.warn,
): DatabaseRecord<C> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError(`Invalid ${collection} record`);
    }
    const input = value as Record<string, unknown>;
    const parsed = databaseSchemas[collection].parse(input) as Record<string, unknown>;
    if (collection === "projects" && parsed.name !== undefined) {
        parsed.title ??= parsed.name;
        delete parsed.name;
    }
    const unknown = Object.keys(input).filter((key) => !(key in databaseSchemas[collection].shape));
    if (unknown.length) {
        warn(`Stripped unknown ${collection} fields: ${unknown.join(", ")}`);
    }
    return {
        ...parsed,
        id: typeof parsed.id === "string" ? parsed.id : uuid(),
    } as DatabaseRecord<C>;
}
