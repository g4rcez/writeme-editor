import type { MenuItemConstructorOptions } from "electron";

export function createApplicationMenuTemplate(appItems: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
    return [
        { label: "Writeme", submenu: appItems },
        { label: "View", submenu: [{ role: "toggleDevTools" }] },
    ];
}
