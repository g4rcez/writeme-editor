import { Button } from "@g4rcez/components";
import { useRef, useState } from "react";
import { importFromFile, startMigration } from "@/lib/data-migration";
import { useUIStore } from "@/store/ui.store";
import { SettingsPageShell } from "./settings-page-shell";

export default function SettingsMigrationPage() {
    const [, uiDispatch] = useUIStore();
    const [migrating, setMigrating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <SettingsPageShell
            title="Migration"
            description="Import notes, tabs, hashtags, settings, and scripts from the previous Writeme web domain."
        >
            <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                    Moved from <strong>www.writeme.dev</strong>? Import your data from the old domain or from an
                    exported JSON file.
                </p>
                <div className="flex flex-wrap gap-3">
                    <Button
                        size="small"
                        disabled={migrating}
                        onClick={async () => {
                            setMigrating(true);
                            try {
                                const counts = await startMigration();
                                uiDispatch.setAlert({
                                    open: true,
                                    message: `Migrated ${counts.notes} notes, ${counts.tabs} tabs, ${counts.settings} settings, ${counts.hashtags} hashtags, ${counts.scripts} scripts.`,
                                    type: "success",
                                });
                            } catch (err) {
                                uiDispatch.setAlert({
                                    open: true,
                                    message: err instanceof Error ? err.message : "Migration failed.",
                                    type: "error",
                                });
                            } finally {
                                setMigrating(false);
                            }
                        }}
                    >
                        {migrating ? "Migrating..." : "Migrate from www.writeme.dev"}
                    </Button>
                    <Button size="small" theme="ghost-primary" onClick={() => fileInputRef.current?.click()}>
                        Import from file
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            event.target.value = "";
                            try {
                                const counts = await importFromFile(file);
                                uiDispatch.setAlert({
                                    open: true,
                                    message: `Imported ${counts.notes} notes, ${counts.tabs} tabs, ${counts.settings} settings, ${counts.hashtags} hashtags, ${counts.scripts} scripts.`,
                                    type: "success",
                                });
                            } catch (err) {
                                uiDispatch.setAlert({
                                    open: true,
                                    message: err instanceof Error ? err.message : "Import failed.",
                                    type: "error",
                                });
                            }
                        }}
                    />
                </div>
            </div>
        </SettingsPageShell>
    );
}
