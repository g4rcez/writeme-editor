import type { ReactNode } from "react";

type SettingsPageShellProps = {
    title: string;
    description: string;
    actions?: ReactNode;
    children: ReactNode;
};

export function SettingsPageShell({ title, description, actions, children }: SettingsPageShellProps) {
    return (
        <section className="writeme-settings-shell mx-auto min-h-full w-full max-w-5xl px-4 py-6 pb-20 sm:px-6 sm:py-8 xl:px-10">
            <header className="mb-6 flex flex-col gap-5 border-b border-border/45 pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl">
                    <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                        <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                        Settings / {title}
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
                {actions ? <div className="flex shrink-0 gap-2 self-start sm:self-auto">{actions}</div> : null}
            </header>
            <div className="w-full">{children}</div>
        </section>
    );
}
