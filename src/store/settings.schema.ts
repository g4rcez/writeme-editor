import { z } from "zod";

export const SettingsSchema = z.object({
  directory: z.string().nullable().default(null),
  templatesDirectory: z.string().nullable().default(null),
  quicknotesDirectory: z.string().nullable().default(null),
  defaultAuthor: z.string().default("user"),
  autoSyncInterval: z.number().default(5000),
  conflictResolution: z
    .enum(["ask", "file-wins", "editor-wins"])
    .default("ask"),
  theme: z
    .enum(["light", "dark", "catppuccin-mocha", "tokyonight-night", "native"])
    .default("dark"),
  autosave: z.boolean().default(true),
  autosaveDelay: z.number().default(5000),
  editorFontSize: z.number().min(12).max(96).default(16),
  sidebarWidth: z.number().min(150).max(600).default(320),
  explorerRoot: z.string().nullable().default(null),
  currency: z
    .object({
      cacheDuration: z.number().default(60 * 60 * 1000),
      preferredAPI: z
        .enum(["exchangerate-api", "frankfurter"])
        .default("frankfurter"),
      apiKey: z.string().optional(),
    })
    .default({
      cacheDuration: 60 * 60 * 1000,
      preferredAPI: "frankfurter",
    }),
  quickNoteShortcut: z.string().default("CommandOrControl+Alt+N"),
  mathNoteShortcut: z.string().default("CommandOrControl+Alt+M"),
  mathNoteId: z.string().nullable().default(null),
  trashRetentionDays: z
    .union([z.literal(7), z.literal(10), z.literal(30), z.literal("never")])
    .default(10),
});

export type AppSettings = z.infer<typeof SettingsSchema>;
