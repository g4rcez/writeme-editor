import type { MenuItemConstructorOptions } from "electron";

export function createApplicationMenuTemplate(appItems: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
    return [
        { label: "Writeme", submenu: appItems },
        { role: "editMenu" },
        { label: "View", submenu: [{ role: "toggleDevTools" }] },
    ];
}
