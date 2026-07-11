import { z } from "zod";

const NOTE_TYPES = ["note", "quick", "read-it-later", "template"] as const;

export const QueryNotesArgsSchema = z.object({
    tag: z.string().optional(),
    type: z.enum(NOTE_TYPES).optional(),
    search: z.string().optional(),
    limit: z.number().int().min(1).max(1000).default(20),
    json: z.boolean().default(false),
});

export const QueryTagsArgsSchema = z.object({
    note: z.string().optional(),
    json: z.boolean().default(false),
});

export const QuerySettingsArgsSchema = z.object({
    json: z.boolean().default(false),
});

export const QueryProjectsArgsSchema = z.object({
    json: z.boolean().default(false),
});

export type QueryNotesArgs = z.infer<typeof QueryNotesArgsSchema>;
export type QueryTagsArgs = z.infer<typeof QueryTagsArgsSchema>;
export type QuerySettingsArgs = z.infer<typeof QuerySettingsArgsSchema>;
export type QueryProjectsArgs = z.infer<typeof QueryProjectsArgsSchema>;
