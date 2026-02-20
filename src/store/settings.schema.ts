import { z } from "zod";

export const SettingsSchema = z.object({
  directory: z.string().nullable().default(null),
  templatesDirectory: z.string().nullable().default(null),
  defaultAuthor: z.string().default("user"),
  autoSyncInterval: z.number().default(5000),
  conflictResolution: z
    .enum(["ask", "file-wins", "editor-wins"])
    .default("ask"),
  theme: z.enum(["light", "dark"]).default("dark"),
  autosave: z.boolean().default(true),
  autosaveDelay: z.number().default(5000),
  editorFontSize: z.number().min(12).max(96).default(16),
  sidebarWidth: z.number().min(150).max(600).default(208),
  isSidebarCollapsed: z.boolean().default(false),
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
});

export type AppSettings = z.infer<typeof SettingsSchema>;
