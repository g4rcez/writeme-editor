import { Capacitor } from "@capacitor/core";

export function sanitizeFilename(filename: string): string {
    return (
        filename
            .replace(/[\\/:*?"<>|]/g, "-")
            .split("")
            .map((character) => (character.charCodeAt(0) < 32 ? "-" : character))
            .join("")
            .replace(/^\.+/, "")
            .trim() || "note.md"
    );
}

function readBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result !== "string") {
                reject(new Error("Could not prepare the file for sharing."));
                return;
            }
            resolve(reader.result.slice(reader.result.indexOf(",") + 1));
        };
        reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
        reader.readAsDataURL(blob);
    });
}

export async function exportFile(filename: string, blob: Blob): Promise<void> {
    const safeName = sanitizeFilename(filename);
    if (Capacitor.isNativePlatform()) {
        const [{ Filesystem, Directory }, { Share }] = await Promise.all([
            import("@capacitor/filesystem"),
            import("@capacitor/share"),
        ]);
        const { uri } = await Filesystem.writeFile({
            path: `exports/${safeName}`,
            directory: Directory.Cache,
            data: await readBase64(blob),
            recursive: true,
        });
        await Share.share({ title: safeName, files: [uri], dialogTitle: "Export from Writeme" });
        return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safeName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
