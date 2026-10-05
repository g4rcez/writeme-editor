import { AISettings } from "@/app/components/settings/ai-settings";
import { SettingsPageShell } from "./settings-page-shell";

export default function SettingsAIPage() {
    return (
        <SettingsPageShell
            title="AI"
            description="Configure the AI provider, credentials, model, and command behavior."
        >
            <div className="py-4">
                <AISettings />
            </div>
        </SettingsPageShell>
    );
}
