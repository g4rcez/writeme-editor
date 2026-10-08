import { isElectron } from "./is-electron";

export async function copyDeviceCode(code: string): Promise<boolean> {
    try {
        if (isElectron()) {
            await window.electronAPI.ai.copyDeviceCode(code);
        } else {
            await navigator.clipboard.writeText(code);
        }
        return true;
    } catch {
        return false;
    }
}
