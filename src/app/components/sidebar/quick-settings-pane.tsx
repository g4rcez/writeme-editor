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
    <div className="flex flex-col h-full bg-background/50">
      <div className="flex items-center justify-between py-2 px-4 border-b border-border/20">
        <span className="font-bold tracking-wider uppercase text-[10px] text-muted-foreground">
          Settings
        </span>
        {saving ? (
          <span className="text-[10px] text-muted-foreground">Saving...</span>
        ) : null}
      </div>
      <div className="overflow-y-auto p-4 space-y-8">
        <section className="space-y-4">
          <span className="font-bold tracking-wider uppercase text-[10px] text-muted-foreground">
            Quick Actions
          </span>
          <QuickSettingsControls
            compact
            onPatch={onPatch}
            settings={settings}
          />
        </section>
        <nav className="space-y-1" aria-label="Settings sections">
          <span className="block pb-1 font-bold tracking-wider uppercase text-[10px] text-muted-foreground">
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
