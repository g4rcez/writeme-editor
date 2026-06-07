import { Card } from "@g4rcez/components";
import type { ReactNode } from "react";

type SettingsPageShellProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function SettingsPageShell({
  title,
  description,
  actions,
  children,
}: SettingsPageShellProps) {
  return (
    <section className="mx-auto w-full max-w-safe px-4 pb-20">
      <header className="mb-8 flex flex-col gap-4 border-b border-border/30 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="mb-2 text-xs text-muted-foreground">
            Settings
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </header>
      <div className="w-full">{children}</div>
    </section>
  );
}
