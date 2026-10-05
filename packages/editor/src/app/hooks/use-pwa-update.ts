import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { isElectron } from "@/lib/is-electron";

const ELECTRON = isElectron();
const PWA_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

const checkForServiceWorkerUpdate = (registration: ServiceWorkerRegistration): void => {
    void registration.update().catch((error: unknown) => {
        console.error("Failed to check for a service worker update:", error);
    });
};

const watchForServiceWorkerUpdates = (
    registration: ServiceWorkerRegistration | undefined,
): (() => void) | undefined => {
    if (ELECTRON || !registration) return undefined;

    const checkForUpdate = () => checkForServiceWorkerUpdate(registration);

    checkForUpdate();

    const intervalId = window.setInterval(checkForUpdate, PWA_UPDATE_CHECK_INTERVAL_MS);

    const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") checkForUpdate();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
        window.clearInterval(intervalId);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
};

export const usePwaUpdate = (): void => {
    const updateCleanupRef = useRef<(() => void) | undefined>(undefined);

    const {
        needRefresh: [needRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        immediate: true,
        onNeedReload: () => {
            if (!ELECTRON) window.location.reload();
        },
        onRegisteredSW: (_swScriptUrl, registration) => {
            updateCleanupRef.current?.();
            updateCleanupRef.current = watchForServiceWorkerUpdates(registration);
        },
        onRegisterError: (error) => {
            console.error("Service worker registration failed:", error);
        },
    });

    useEffect(() => {
        if (!ELECTRON && needRefresh) void updateServiceWorker(true);
    }, [needRefresh, updateServiceWorker]);

    useEffect(
        () => () => {
            updateCleanupRef.current?.();
            updateCleanupRef.current = undefined;
        },
        [],
    );
};
