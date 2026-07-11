import { Button } from "@g4rcez/components";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";

function getRouteErrorMessage(error: unknown): string {
    if (isRouteErrorResponse(error)) {
        return `${error.status} ${error.statusText}`;
    }

    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === "string") {
        return error;
    }

    return "Unknown route error";
}

function isDynamicImportFailure(message: string): boolean {
    return (
        message.includes("Failed to fetch dynamically imported module") ||
        message.includes("Importing a module script failed")
    );
}

export function RouteErrorBoundary() {
    const error = useRouteError();
    const navigate = useNavigate();
    const message = getRouteErrorMessage(error);
    const dynamicImportFailure = isDynamicImportFailure(message);

    return (
        <div className="flex min-h-full items-center justify-center px-6 py-12 text-foreground">
            <section
                role="alert"
                className="w-full max-w-xl rounded-card-radius border border-card-border bg-card-background p-6 shadow-soft"
            >
                <p className="text-sm font-medium text-muted-foreground">Page failed to load</p>
                <h1 className="mt-2 text-xl font-semibold text-foreground">
                    {dynamicImportFailure ? "This page module is out of date." : "Something went wrong on this page."}
                </h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {dynamicImportFailure
                        ? "Reload the app to fetch the latest page module from the dev server."
                        : "You can go back and keep working, or reload if the page keeps failing."}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                    <Button size="small" onClick={() => window.location.reload()}>
                        Reload app
                    </Button>
                    <Button size="small" theme="muted" onClick={() => navigate(-1)}>
                        Go back
                    </Button>
                </div>

                <details className="mt-5 rounded-button-radius border border-card-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-medium text-foreground">Technical details</summary>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-5">
                        {message}
                    </pre>
                </details>
            </section>
        </div>
    );
}
