import { z } from "zod";
import { LOCAL_WHISPER_ENDPOINT, LOCAL_WHISPER_MODEL } from "@/lib/meeting-models";

export const SettingsSchema = z.preprocess(
    (input) => {
        if (
            input &&
            typeof input === "object" &&
            !Array.isArray(input) &&
            !("vimMode" in input) &&
            "rawEditorVimMode" in input
        ) {
            return { ...input, vimMode: input.rawEditorVimMode };
        }
        return input;
    },
    z.object({
        directory: z.string().nullable().default(null),
        templatesDirectory: z.string().nullable().default(null),
        quicknotesDirectory: z.string().nullable().default(null),
        defaultAuthor: z.string().default("user"),
        meetingOnboardingStatus: z.enum(["pending", "skipped", "completed"]).default("pending"),
        meetingTranscription: z
            .object({
                endpoint: z
                    .url()
                    .refine((value) => {
                        const url = new URL(value);
                        return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
                    }, "Use an HTTP or HTTPS endpoint without embedded credentials.")
                    .default(LOCAL_WHISPER_ENDPOINT),
                model: z.string().trim().min(1).max(200).default(LOCAL_WHISPER_MODEL),
                localSpeaker: z.string().trim().min(1).max(200).default("Me"),
                includeSystemAudio: z.boolean().default(true),
            })
            .default({
                endpoint: LOCAL_WHISPER_ENDPOINT,
                model: LOCAL_WHISPER_MODEL,
                localSpeaker: "Me",
                includeSystemAudio: true,
            }),
        autoSyncInterval: z.number().default(5000),
        conflictResolution: z.enum(["ask", "file-wins", "editor-wins"]).default("ask"),
        theme: z.enum(["light", "dark", "catppuccin-mocha", "tokyonight-night", "native"]).default("dark"),
        autosave: z.boolean().default(true),
        autosaveDelay: z.number().default(5000),
        editorMode: z.enum(["formatted", "markdown"]).default("formatted"),
        vimMode: z.boolean().default(false),
        vimConfig: z.string().max(50_000).default(""),
        editorFontSize: z.number().min(12).max(96).default(16),
        sidebarWidth: z.number().min(150).max(600).default(320),
        explorerRoot: z.string().nullable().default(null),
        currency: z
            .object({
                cacheDuration: z.number().default(60 * 60 * 1000),
                preferredAPI: z.enum(["exchangerate-api", "frankfurter"]).default("frankfurter"),
                apiKey: z.string().optional(),
            })
            .default({
                cacheDuration: 60 * 60 * 1000,
                preferredAPI: "frankfurter",
            }),
        quickNoteShortcut: z.string().default("CommandOrControl+Alt+N"),
        mathNoteShortcut: z.string().default("CommandOrControl+Alt+M"),
        floatingEditorShortcut: z.string().default("CommandOrControl+Alt+P"),
        mathNoteId: z.string().nullable().default(null),
        trashRetentionDays: z.union([z.literal(7), z.literal(10), z.literal(30), z.literal("never")]).default(10),
    }),
);

export type AppSettings = z.infer<typeof SettingsSchema>;
