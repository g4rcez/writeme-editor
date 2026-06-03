import { SettingsPageShell } from "./settings-page-shell";

export default function SettingsNotFoundPage() {
  return (
    <SettingsPageShell
      title="Not found"
      description="This settings section is not available."
    >
      <div className="py-10 text-sm text-muted-foreground">
        Choose another settings section from the sidebar.
      </div>
    </SettingsPageShell>
  );
}
