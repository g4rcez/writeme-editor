import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from "electron";

export function registerSpellingContextMenus(): void {
    app.on("web-contents-created", (_event, contents) => {
        contents.on("context-menu", (event, params) => {
            if (!params.isEditable) return;
            const owner = BrowserWindow.fromWebContents(contents);
            if (!owner || owner.isDestroyed()) return;

            const template: MenuItemConstructorOptions[] = [];
            for (const suggestion of new Set(params.dictionarySuggestions ?? [])) {
                template.push({
                    label: suggestion,
                    click: () => {
                        if (!contents.isDestroyed() && !owner.isDestroyed()) contents.replaceMisspelling(suggestion);
                    },
                });
            }

            const misspelledWord = params.misspelledWord;
            if (misspelledWord) {
                if (template.length > 0) template.push({ type: "separator" });
                template.push({
                    label: "Add to dictionary",
                    click: () => {
                        if (!contents.isDestroyed()) {
                            contents.session.addWordToSpellCheckerDictionary(misspelledWord);
                        }
                    },
                });
            }

            if (template.length > 0) template.push({ type: "separator" });
            template.push(
                { role: "undo" },
                { role: "redo" },
                { type: "separator" },
                { role: "cut" },
                { role: "copy" },
                { role: "paste" },
                { role: "delete" },
                { type: "separator" },
                { role: "selectAll" },
            );

            event.preventDefault();
            Menu.buildFromTemplate(template).popup({ window: owner, x: params.x, y: params.y });
        });
    });
}
