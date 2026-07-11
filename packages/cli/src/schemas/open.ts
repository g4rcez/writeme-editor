import path from "node:path";
import { z } from "zod";

export const OpenFileArgsSchema = z.object({
    filePath: z
        .string()
        .refine((p) => path.isAbsolute(p), "filePath must be absolute")
        .nullable()
        .default(null),
    wait: z.boolean().default(false),
});

export const OpenFolderArgsSchema = z.object({
    folderPath: z.string().refine((p) => path.isAbsolute(p), "folderPath must be absolute"),
});

export type OpenFileArgs = z.infer<typeof OpenFileArgsSchema>;
export type OpenFolderArgs = z.infer<typeof OpenFolderArgsSchema>;
