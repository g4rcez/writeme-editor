import type { JSX, ReactNode } from "react";

type SettingsPageShellProps = {
    title: string;
    description: string;
    actions?: ReactNode;
    children: ReactNode;
};

export function SettingsPageShell({ title, description, actions, children }: SettingsPageShellProps): JSX.Element {
    return (
        <section className="writeme-settings-shell mx-auto min-h-full w-full min-w-0 max-w-4xl px-4 py-6 pb-20 sm:px-8 sm:py-8 xl:px-10">
            <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 max-w-xl">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
                {actions ? <div className="flex shrink-0 flex-wrap gap-2 self-start sm:pt-1">{actions}</div> : null}
            </header>
            <div className="w-full">{children}</div>
        </section>
    );
}
