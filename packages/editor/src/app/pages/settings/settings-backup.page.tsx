import { Button } from "@g4rcez/components";
import { useRef, useState, type JSX } from "react";
import { exportFile } from "@/lib/export-file";
import { createMobileBackup, restoreMobileBackup } from "@/lib/mobile-backup";
import { SettingsPageShell } from "./settings-page-shell";

export default function SettingsBackupPage(): JSX.Element {
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [restored, setRestored] = useState(false);

    return (
        <SettingsPageShell title="Backup" description="Keep a copy of your on-device notes and attachments.">
            <div className="space-y-4 text-sm text-foreground">
                <p>
                    Notes are stored on this device. Export a backup before uninstalling Writeme. Backups include PDFs,
                    drawings, comments, tags, groups, views, scripts, and note history. Device settings and AI data are
                    excluded.
                </p>
                <p>
                    Restore adds records without replacing existing ones. A conflicting record stops the entire import.
                </p>
                <div className="flex flex-wrap gap-3">
                    <Button
                        disabled={busy}
                        onClick={async () => {
                            setBusy(true);
                            setError(null);
                            try {
                                await exportFile(
                                    `writeme-backup-${new Date().toISOString().slice(0, 10)}.json`,
                                    await createMobileBackup(),
                                );
                            } catch (reason) {
                                setError(reason instanceof Error ? reason.message : "Could not export the backup.");
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        Export backup
                    </Button>
                    <Button theme="ghost-primary" disabled={busy} onClick={() => input.current?.click()}>
                        Restore backup
                    </Button>
                    <input
                        ref={input}
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        aria-label="Backup file"
                        onChange={async (event) => {
                            const file = event.currentTarget.files?.[0];
                            event.currentTarget.value = "";
                            if (!file) return;
                            setBusy(true);
                            setError(null);
                            setRestored(false);
                            try {
                                await restoreMobileBackup(file);
                                setRestored(true);
                            } catch (reason) {
                                setError(reason instanceof Error ? reason.message : "Could not restore the backup.");
                            } finally {
                                setBusy(false);
                            }
                        }}
                    />
                </div>
                {busy && <output className="block">Transferring backup...</output>}
                {error && <p role="alert">{error}</p>}
                {restored && (
                    <div className="space-y-3">
                        <output className="block">Backup restored. Reload to open the imported notes.</output>
                        <Button onClick={() => window.location.reload()}>Reload library</Button>
                    </div>
                )}
            </div>
        </SettingsPageShell>
    );
}
