import { NavLink } from "react-router-dom";
import { css } from "@g4rcez/components";
import { QuickSettingsControls } from "@/app/components/settings/settings-controls";
import {
  getSettingsSections,
  type SettingsSection,
} from "@/app/settings/settings-sections";
import {
  registerGlobalShortcuts,
  saveSettingsPatch,
} from "@/app/settings/save-settings-section";
import { globalDispatch } from "@/store/global.store";
import { type AppSettings, SettingsService } from "@/store/settings";
import { useState } from "react";

export const QuickSettingsPane = () => {
  const [settings, setSettings] = useState(() => SettingsService.load());
  const [saving, setSaving] = useState(false);
  const sections = getSettingsSections();

  const onPatch = async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    try {
      const shortcutChanged =
        "quickNoteShortcut" in patch || "mathNoteShortcut" in patch;
      if (patch.theme) {
        globalDispatch.theme(patch.theme);
      } else if (!shortcutChanged) {
        await saveSettingsPatch(patch);
      }
      if (shortcutChanged) {
        await saveSettingsPatch(patch);
        await registerGlobalShortcuts(next);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between py-2 px-4 borderr">
        <span className="text-xs text-muted-foreground">Settings</span>
        {saving ? (
          <span className="text-xs text-muted-foreground">Saving...</span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-4">
        <section className="space-y-4">
          <span className="text-xs text-muted-foreground">Quick settings</span>
          <QuickSettingsControls
            compact
            onPatch={onPatch}
            settings={settings}
          />
        </section>
        <nav className="space-y-1" aria-label="Settings sections">
          <span className="block pb-1 text-xs text-muted-foreground">
            Sections
          </span>
          {sections.map((section) => (
            <SettingsSectionLink key={section.id} section={section} />
          ))}
        </nav>
      </div>
    </div>
  );
};

type SettingsSectionLinkProps = {
  section: SettingsSection;
};

function SettingsSectionLink({ section }: SettingsSectionLinkProps) {
  return (
    <NavLink
      to={section.path}
      className={({ isActive }) =>
        css(
          "flex w-full flex-col rounded-md px-2 py-2 text-left transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-foreground/60 hover:bg-muted/50 hover:text-foreground",
        )
      }
    >
      <span className="text-sm font-medium">{section.label}</span>
      <span className="text-[11px] leading-snug text-muted-foreground">
        {section.description}
      </span>
    </NavLink>
  );
}
