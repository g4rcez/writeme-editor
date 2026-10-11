import { computePosition, flip, shift } from "@floating-ui/dom";
import {
    filterCompletionItems,
    completionInsertionContext,
    completionWorkspaceKey,
    filterWordItems,
    loadWorkspaceCompletions,
    type CompletionContext,
    type CompletionItem,
} from "./editor-completion-data";

export type CompletionAdapter = {
    noteId: () => string | undefined;
    target: HTMLElement;
    context: (active?: CompletionContext) => CompletionContext | null;
    headings: () => CompletionItem[];
    tags: (context: CompletionContext) => CompletionItem[];
    words: (context: CompletionContext) => CompletionItem[];
    rect: () => DOMRect | null;
    insert: (item: CompletionItem, context: CompletionContext) => void;
};

export function createCompletionMenu(adapter: CompletionAdapter): {
    handleKeyDown: (event: KeyboardEvent) => boolean;
    update: (docChanged: boolean) => void;
    close: () => void;
    destroy: () => void;
} {
    let context: CompletionContext | null = null;
    let menu: HTMLUListElement | null = null;
    let candidates: CompletionItem[] = [];
    let items: CompletionItem[] = [];
    let selectedIndex = 0;
    let generation = 0;
    let loading = false;
    let error = false;
    let workspace: string | undefined;
    const menuId = `editor-completion-${crypto.randomUUID()}`;

    const close = (): void => {
        generation += 1;
        context = null;
        workspace = undefined;
        candidates = [];
        menu?.remove();
        menu = null;
        adapter.target.removeAttribute("aria-controls");
        adapter.target.removeAttribute("aria-activedescendant");
        adapter.target.removeAttribute("aria-autocomplete");
    };

    const select = (index: number): void => {
        if (workspace !== completionWorkspaceKey()) {
            close();
            return;
        }
        const item = items[index];
        const current = adapter.context(context ?? undefined);
        if (!item || !current || !context || current.from !== context.from || current.trigger !== context.trigger)
            return;
        close();
        adapter.insert(item, completionInsertionContext(item, current));
    };

    const position = (): void => {
        const element = menu;
        const rect = adapter.rect();
        if (!element || !rect) return;
        void computePosition({ getBoundingClientRect: () => rect }, element, {
            placement: "bottom-start",
            strategy: "fixed",
            middleware: [flip(), shift({ padding: 8 })],
        }).then(({ x, y }) => {
            if (element !== menu) return;
            element.style.left = `${x}px`;
            element.style.top = `${y}px`;
        });
    };

    const render = (): void => {
        if (!menu || !context) return;
        items =
            context.trigger === "word"
                ? filterWordItems(candidates, context.query)
                : filterCompletionItems(
                      [
                          ...(context.trigger === "#" ? [...adapter.headings(), ...adapter.tags(context)] : []),
                          ...candidates,
                      ],
                      context.query,
                  );
        selectedIndex = Math.min(selectedIndex, Math.max(0, items.length - 1));
        menu.replaceChildren();
        for (const [index, item] of items.entries()) {
            const row = document.createElement("li");
            row.setAttribute("role", "presentation");
            const button = document.createElement("button");
            button.type = "button";
            button.id = `${menuId}-${index}`;
            button.setAttribute("role", "option");
            button.setAttribute("aria-selected", String(index === selectedIndex));
            button.className =
                "flex min-h-11 w-full flex-col rounded-md px-3 py-2 text-left text-foreground hover:bg-muted/50 aria-selected:bg-primary/10";
            const label = document.createElement("span");
            label.className = "text-sm font-medium break-all";
            label.textContent = `${item.kind === "tag" ? "#" : ""}${item.label}`;
            const detail = document.createElement("span");
            detail.className = "text-xs text-muted-foreground break-all";
            detail.textContent =
                item.description ||
                (item.kind === "heading"
                    ? "Heading"
                    : item.kind === "tag"
                      ? "Tag"
                      : item.kind === "word"
                        ? "Word"
                        : "File");
            button.append(label, detail);
            button.addEventListener("mousedown", (event) => event.preventDefault());
            button.addEventListener("click", () => select(index));
            row.append(button);
            menu.append(row);
        }
        if (loading || error || items.length === 0) {
            const status = document.createElement("li");
            status.setAttribute("role", "presentation");
            const message = document.createElement("span");
            message.setAttribute("role", "status");
            message.className = "block px-3 py-2 text-sm text-muted-foreground";
            message.textContent = loading
                ? "Loading suggestions…"
                : error
                  ? "Unable to load workspace suggestions. Press Ctrl+Space to retry."
                  : "No suggestions found";
            status.append(message);
            menu.append(status);
        }
        const selected = menu.querySelector<HTMLElement>('[aria-selected="true"]');
        if (selected) {
            adapter.target.setAttribute("aria-activedescendant", selected.id);
            selected.scrollIntoView({ block: "nearest" });
        } else adapter.target.removeAttribute("aria-activedescendant");
        position();
    };

    const open = (): boolean => {
        const next = adapter.context(context ?? undefined);
        if (!next) return false;
        close();
        context = next;
        workspace = completionWorkspaceKey();
        selectedIndex = 0;
        loading = next.trigger !== "word";
        error = false;
        if (next.trigger === "word") candidates = adapter.words(next);
        menu = document.createElement("ul");
        menu.id = menuId;
        menu.setAttribute("role", "listbox");
        menu.setAttribute(
            "aria-label",
            next.trigger === "#"
                ? "Heading and tag suggestions"
                : next.trigger === "word"
                  ? "Document word suggestions"
                  : "Workspace file suggestions",
        );
        menu.className =
            "fixed z-50 flex max-h-64 w-80 max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-lg border border-border bg-background p-1 shadow-lg";
        document.body.append(menu);
        adapter.target.setAttribute("aria-controls", menuId);
        adapter.target.setAttribute("aria-autocomplete", "list");
        render();
        if (next.trigger === "word") return true;
        const requestGeneration = generation;
        void loadWorkspaceCompletions(next.trigger, adapter.noteId())
            .then((results) => {
                if (generation !== requestGeneration) return;
                if (workspace !== completionWorkspaceKey()) {
                    close();
                    return;
                }
                candidates = results;
                loading = false;
                render();
            })
            .catch(() => {
                if (generation !== requestGeneration) return;
                loading = false;
                error = true;
                render();
            });
        return true;
    };

    const handleKeyDown = (event: KeyboardEvent): boolean => {
        if (event.isComposing) return false;
        if (event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.code === "Space") {
            if (event.repeat && menu) {
                event.preventDefault();
                return true;
            }
            const opened = open();
            if (opened) event.preventDefault();
            return opened;
        }
        if (!menu) return false;
        if (event.key === "Escape") close();
        else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            if (items.length)
                selectedIndex = (selectedIndex + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
            render();
        } else if ((event.key === "Enter" || event.key === "Tab") && items.length) select(selectedIndex);
        else return false;
        event.preventDefault();
        return true;
    };

    const update = (docChanged: boolean): void => {
        if (!menu || !context) return;
        if (workspace !== completionWorkspaceKey()) {
            close();
            return;
        }
        const next = adapter.context(context);
        if (
            !next ||
            next.from !== context.from ||
            next.trigger !== context.trigger ||
            (!docChanged && next.cursor !== context.cursor)
        ) {
            close();
            return;
        }
        if (next.query !== context.query) selectedIndex = 0;
        context = next;
        render();
    };

    const onPointerDown = (event: PointerEvent): void => {
        if (event.target instanceof Node && !menu?.contains(event.target)) close();
    };
    const onBlur = (): void => close();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    adapter.target.addEventListener("blur", onBlur);
    return {
        handleKeyDown,
        update,
        close,
        destroy: () => {
            close();
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("scroll", position, true);
            window.removeEventListener("resize", position);
            adapter.target.removeEventListener("blur", onBlur);
        },
    };
}
