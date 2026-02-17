import { z } from "zod";

export const SettingsSchema = z.object({
  directory: z.string().nullable().default(null),
  defaultAuthor: z.string().default("user"),
  autoSyncInterval: z.number().default(5000),
  conflictResolution: z.enum(["ask", "file-wins", "editor-wins"]).default("ask"),
  theme: z.enum(["light", "dark"]).default("dark"),
  autosave: z.boolean().default(true),
  autosaveDelay: z.number().default(5000),
  currency: z.object({
    cacheDuration: z.number().default(60 * 60 * 1000),
    preferredAPI: z.enum(["exchangerate-api", "frankfurter"]).default("frankfurter"),
    apiKey: z.string().optional(),
  }).default({
    cacheDuration: 60 * 60 * 1000,
    preferredAPI: "frankfurter",
  }),
});

export type AppSettings = z.infer<typeof SettingsSchema>;
