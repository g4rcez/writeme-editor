import { CustomVariables } from "@/app/components/settings/custom-variables";
import { SettingsPageShell } from "./settings-page-shell";

export default function SettingsVariablesPage() {
    return (
        <SettingsPageShell title="Variables" description="Create reusable JavaScript expressions for templates.">
            <div className="py-4">
                <CustomVariables />
            </div>
        </SettingsPageShell>
    );
}
