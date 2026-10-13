import type { JSX } from "react";
import { css } from "@g4rcez/components";
import { NavLink } from "react-router-dom";
import { getSettingsSections, type SettingsSection } from "@/app/settings/settings-sections";

const SETTINGS_GROUPS = ["Writing", "Templates", "Assistance", "Workspace"] as const;

export function QuickSettingsPane(): JSX.Element {
    const sections = getSettingsSections();

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="px-4 pb-2 pt-4">
                <h2 className="text-sm font-semibold text-foreground">Settings</h2>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-6" aria-label="Settings sections">
                {sections
                    .filter((section) => section.group === null)
                    .map((section) => (
                        <SettingsSectionLink key={section.id} section={section} />
                    ))}
                {SETTINGS_GROUPS.map((group) => {
                    const items = sections.filter((section) => section.group === group);
                    if (items.length === 0) return null;
                    return (
                        <section key={group} className="mt-5" aria-label={group}>
                            <h3 className="mb-1 px-3 text-xs font-medium text-muted-foreground">{group}</h3>
                            <ul className="space-y-0.5">
                                {items.map((section) => (
                                    <li key={section.id}>
                                        <SettingsSectionLink section={section} />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    );
                })}
            </nav>
        </div>
    );
}

type SettingsSectionLinkProps = {
    section: SettingsSection;
};

function SettingsSectionLink({ section }: SettingsSectionLinkProps) {
    return (
        <NavLink
            to={section.path}
            title={section.description}
            className={({ isActive }) =>
                css(
                    "flex min-h-10 w-full items-center rounded-md px-3 py-2 text-sm transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                    isActive
                        ? "bg-secondary-background font-semibold text-foreground"
                        : "text-foreground hover:bg-muted/50",
                )
            }
        >
            {section.label}
        </NavLink>
    );
}
