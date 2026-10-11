import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { globalState, globalDispatch } from "@/store/global.store";
import { useUIStore } from "@/store/ui.store";

export function useMobileNavigation(): void {
    const navigate = useNavigate();
    useEffect(() => {
        if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
        let disposed = false;
        let removeListener: (() => Promise<void>) | undefined;
        void import("@capacitor/app")
            .then(async ({ App }) => {
                const listener = await App.addListener("backButton", () => {
                    const ui = useUIStore.getState();
                    const state = globalState();
                    if (ui.confirm) {
                        ui.confirm.onCancel?.();
                        useUIStore.dispatchers.clearConfirm();
                    } else if (ui.prompt) {
                        ui.prompt.onCancel?.();
                        useUIStore.dispatchers.clearPrompt();
                    } else if (ui.alert) useUIStore.dispatchers.clearAlert();
                    else if (state.createNoteDialog.isOpen)
                        globalDispatch.setCreateNoteDialog({ isOpen: false, type: state.createNoteDialog.type });
                    else if (state.commander.enabled) globalDispatch.commander(false);
                    else if (ui.sidebarOpen) useUIStore.dispatchers.setSidebarOpen(false);
                    else if (typeof window.history.state?.idx === "number" && window.history.state.idx > 0)
                        navigate(-1);
                    else void App.minimizeApp();
                });
                if (disposed) await listener.remove();
                else removeListener = () => listener.remove();
            })
            .catch((error: unknown) => console.error("Could not register Android back navigation:", error));
        return () => {
            disposed = true;
            void removeListener?.();
        };
    }, [navigate]);
}
