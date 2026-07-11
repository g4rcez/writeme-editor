import { repositories } from "@/store/repositories";
import { SettingsService } from "@/store/settings";

export async function runPurge(): Promise<void> {
    const settings = SettingsService.get();
    const retention = settings.trashRetentionDays;
    if (retention === "never") return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retention);
    await repositories.notes.purgeBefore(cutoff);
}
