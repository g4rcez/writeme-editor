import { Capacitor } from "@capacitor/core";

export const MOBILE_PAUSE_EVENT = "writeme:mobile-pause";

export async function initializeMobileRuntime(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const [{ App }, { Browser }, { StatusBar, Style }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/browser"),
        import("@capacitor/status-bar"),
    ]);

    await App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) window.dispatchEvent(new Event(MOBILE_PAUSE_EVENT));
    });

    const applyStatusBar = async (): Promise<void> => {
        const dark =
            document.documentElement.classList.contains("dark") ||
            document.documentElement.classList.contains("catppuccin-mocha") ||
            document.documentElement.classList.contains("tokyonight-night") ||
            document.documentElement.classList.contains("native");
        await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    };
    const reportError = (error: unknown): void => {
        console.error("Mobile system integration failed:", error instanceof Error ? error.message : error);
    };
    await applyStatusBar();
    new MutationObserver(() => void applyStatusBar().catch(reportError)).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
    });

    document.addEventListener("click", (event) => {
        if (event.defaultPrevented || !(event.target instanceof Element)) return;
        const anchor = event.target.closest("a");
        if (!anchor) return;
        const url = new URL(anchor.href, window.location.href);
        if (!["https:", "http:"].includes(url.protocol) || url.origin === window.location.origin) return;
        event.preventDefault();
        void Browser.open({ url: url.href }).catch(reportError);
    });
}
